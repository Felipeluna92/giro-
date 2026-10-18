import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewReceipt, receiptServiceError } from '../lib/receipt.ts';

const sample = {
  establishment: null, order: '0033', customer: 'Cliente de teste', phone: '19991234567',
  address: 'Rua de Teste, 264, Bairro Teste, Piracicaba - SP', complement: 'Casa',
  customerFeeCents: 400, subtotalCents: 2550, serviceFeeCents: 99, discountCents: null,
  orderTotalCents: 3049, payment: 'card', notes: '10 picolés', rawText: 'Comanda fictícia para teste',
  confidence: .95, uncertainFields: [],
};

test('Keeps delivery fee distinct from service fee and total, preserving leading order zeros', () => {
  const result = reviewReceipt(sample);
  assert.equal(result.customerFeeCents, 400);
  assert.equal(result.serviceFeeCents, 99);
  assert.equal(result.orderTotalCents, 3049);
  assert.equal(result.order, '0033');
  assert.equal(result.payment, 'card');
  assert.equal(result.phone, '(19) 99123-4567');
  assert.deepEqual(result.review, []);
});

test('Flags a mismatching total without silently changing the written charge', () => {
  const result = reviewReceipt({...sample, orderTotalCents: 2550});
  assert.equal(result.orderTotalCents, 2550);
  assert(result.review.some(item => item.field === 'amounts'));
});

test('Does not convert an absent payment to paid or invent a missing delivery fee', () => {
  const result = reviewReceipt({...sample, payment: null, customerFeeCents: null});
  assert.equal(result.payment, null);
  assert.equal(result.customerFeeCents, null);
  assert(result.review.some(item => item.field === 'payment'));
  assert(result.review.some(item => item.field === 'customerFeeCents'));
});

test('Clears ambiguous critical fields and leaves the transcription for manual comparison', () => {
  const result = reviewReceipt({...sample, uncertainFields: ['phone', 'address', 'customerFeeCents', 'order']});
  for (const field of ['phone','address','customerFeeCents','order']) assert.equal(result[field], null);
  assert.equal(result.rawText, sample.rawText);
  assert.equal(result.review.length, 4);
});

test('Flags incomplete telephone digits instead of completing them from context', () => {
  const result = reviewReceipt({...sample, phone: '19 9123 456'});
  assert.equal(result.phone, null);
  assert(result.review.some(item => item.field === 'phone'));
  assert.equal(reviewReceipt({...sample, phone: '+55 (19) 99123-4567'}).phone, '(19) 99123-4567');
});

test('Preserves explicit zero fees and warns when fee exceeds the total', () => {
  assert.equal(reviewReceipt({...sample, customerFeeCents: 0}).customerFeeCents, 0);
  assert(reviewReceipt({...sample, customerFeeCents: 4000}).review.some(item => item.field === 'customerFeeCents'));
});

test('Returns useful service errors without exposing provider details or customer data', () => {
  assert.equal(receiptServiceError({cause:{statusCode:402,message:'secret'}}).code,'AI_UNAVAILABLE');
  assert.equal(receiptServiceError({statusCode:429}).code,'AI_BUSY');
  assert.equal(receiptServiceError({name:'TimeoutError'}).status,504);
  assert(!receiptServiceError({statusCode:403,message:'secret'}).error.includes('secret'));
});
