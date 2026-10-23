// Only fixed diagnostic labels may reach the browser. Never serialize provider messages,
// request bodies, identifiers, keys, or customer details.
export function checkoutDiagnostic(error:unknown){
 const e=error&&typeof error==='object'?error as Record<string,unknown>:{};
 const message=typeof e.message==='string'?e.message:'';
 const labels=['payment_method_configuration','excluded_payment_method_types','payment_method_options','expires_at','expires_after_seconds','integration_identifier','idempotency','permission','pix','customer','price','allowed_payment_method_types','payment_method_types','automatic_payment_methods','not available','not enabled','no valid','incompatible','mutually exclusive','not supported','billing_address_collection','tax_id_collection','customer_update','customer_creation'] as const;
 const types=['StripeInvalidRequestError','StripePermissionError','StripeAuthenticationError','StripeIdempotencyError','StripeAPIError','StripeConnectionError','StripeRateLimitError'];
 const codes=['parameter_unknown','parameter_invalid_empty','parameter_invalid_integer','parameter_invalid_string_blank','parameter_invalid_string_empty','parameter_invalid_string_too_long','parameter_invalid_combination','resource_missing','idempotency_key_in_use','lock_timeout'];
 return {type:types.includes(String(e.type))?String(e.type):'processing_failed',code:codes.includes(String(e.code))?String(e.code):null,param:labels.find(label=>e.param===label)||null,hints:labels.filter(label=>message.toLowerCase().includes(label))};
}
