import { NextResponse } from 'next/server';
import { planMissionTasks, generateSyntheticDeliverable } from '@/lib/agents';
import { createPayPalEscrowAuthorization, executePayPalPayout } from '@/lib/paypal';
import { TaskContract } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, missionId, goal, task, token, currency = 'USD' } = body;

    if (action === 'plan') {
      const generatedMissionId = missionId || `MSN-${Date.now().toString(36).toUpperCase()}`;
      const tasks = planMissionTasks(generatedMissionId, goal);
      const totalBudget = tasks.reduce((sum, t) => sum + t.budget, 0);

      return NextResponse.json({
        success: true,
        missionId: generatedMissionId,
        tasks,
        totalBudget,
      });
    }

    if (action === 'authorize_mission_escrow') {
      const { totalBudget } = body;
      const authResult = await createPayPalEscrowAuthorization(
        totalBudget,
        currency,
        token,
        missionId
      );

      return NextResponse.json({
        success: true,
        paypalOrderId: authResult.orderId,
        paypalAuthorizationId: authResult.authId,
        isSimulated: authResult.isSimulated,
      });
    }

    if (action === 'execute_and_payout_task') {
      const currentTask = task as TaskContract;
      if (!currentTask) {
        return NextResponse.json({ success: false, error: 'Task data is required' }, { status: 400 });
      }

      // 1. Worker Agent completes work
      const deliverable = generateSyntheticDeliverable(currentTask);

      // 2. Evaluator Agent checks quality score (e.g. >= 80 passes)
      const isPassed = (deliverable.qualityScore || 0) >= 80;

      if (!isPassed) {
        return NextResponse.json({
          success: true,
          status: 'disputed',
          deliverable,
          error: 'Evaluator QA score below threshold. Escrow held.',
        });
      }

      // 3. Automated PayPal Payout triggered
      const payoutResult = await executePayPalPayout(
        currentTask.assignedAgentEmail,
        currentTask.budget,
        `Task Settlement: ${currentTask.title}`,
        currency,
        token
      );

      return NextResponse.json({
        success: true,
        status: 'paid',
        deliverable,
        paypalPayoutBatchId: payoutResult.payoutBatchId,
        paypalPayoutItemId: payoutResult.payoutItemId,
        isSimulated: payoutResult.isSimulated,
        paidAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error executing swarm step';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
