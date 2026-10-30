export type VerificationStatus = 'verified' | 'rejected' | 'needs_review';

export type CheckStatus = 'passed' | 'failed' | 'needs_review';

export type CheckCategory = 
  | 'budget' 
  | 'condition' 
  | 'delivery' 
  | 'subscription' 
  | 'fees' 
  | 'warranty';

export interface VerificationCheck {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  isHardConstraint: boolean;
  expected: string;
  actual: string;
  details: string;
  suggestedRemedy?: string;
}

export interface VerificationReport {
  id: string;
  dealId: string;
  offerId: string;
  offerTitle: string;
  sellerName: string;
  finalPrice: number;
  currency: string;
  verifiedAt: string;
  status: VerificationStatus;
  summary: string;
  checks: VerificationCheck[];
  passedCount: number;
  failedCount: number;
  needsReviewCount: number;
  disclaimer: string;
}
