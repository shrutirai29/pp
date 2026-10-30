export interface DealInputForm {
  rawQuery: string;
  productTitle: string;
  maxBudget: number | '';
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  requiredCondition: 'new' | 'refurbished' | 'any';
  maxDeliveryDays: number | '';
  requiredWarrantyMonths: number | '';
  prohibitSubscriptions: boolean;
  requireAllFeesIncluded: boolean;
  hardConstraints: string[];
}

export interface ValidationErrors {
  rawQuery?: string;
  productTitle?: string;
  maxBudget?: string;
  maxDeliveryDays?: string;
  requiredWarrantyMonths?: string;
  general?: string;
}

export function validateDealInput(form: DealInputForm): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};

  if (!form.rawQuery || form.rawQuery.trim().length < 5) {
    errors.rawQuery = 'Please provide a clear product description (minimum 5 characters).';
  }

  if (!form.productTitle || form.productTitle.trim().length < 2) {
    errors.productTitle = 'Please provide a product name or category.';
  }

  if (form.maxBudget === '' || isNaN(Number(form.maxBudget)) || Number(form.maxBudget) <= 0) {
    errors.maxBudget = 'Maximum budget must be a positive number greater than 0.';
  }

  if (form.maxDeliveryDays === '' || isNaN(Number(form.maxDeliveryDays)) || Number(form.maxDeliveryDays) < 1) {
    errors.maxDeliveryDays = 'Maximum delivery time must be at least 1 day.';
  } else if (Number(form.maxDeliveryDays) > 90) {
    errors.maxDeliveryDays = 'Maximum delivery time cannot exceed 90 days.';
  }

  if (form.requiredWarrantyMonths !== '' && (isNaN(Number(form.requiredWarrantyMonths)) || Number(form.requiredWarrantyMonths) < 0)) {
    errors.requiredWarrantyMonths = 'Warranty must be 0 or more months.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
