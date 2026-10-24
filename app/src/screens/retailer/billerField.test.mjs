// Run: node src/screens/retailer/billerField.test.mjs
// The biller's own label decides the one field the BBPS form asks for. Labels
// below are as Icchhamati's live biller registry spells them.
import assert from 'node:assert';
import { billerField, cleanBillerInput, billerInputValid } from './billerField.ts';

const kind = (label, name = 'Some Biller') => billerField({ name, label }).kind;

assert.equal(kind('Consumer Number'), 'text');
assert.equal(kind('K Number'), 'text');
assert.equal(kind('Registered Contact Number'), 'mobile', 'Bharat Gas / Indane');
assert.equal(kind('Mobile Number'), 'mobile');
assert.equal(kind('Number', 'Jio'), 'mobile', 'Jio postpaid');
assert.equal(kind('Card Last Four Digit'), 'last4', 'ICICI / SBI Card');
assert.equal(kind('Vehicle Registered Number'), 'vehicle');
assert.equal(kind('Vehicle Number'), 'vehicle');

// Billers that ship their own name as the label get a sensible one.
const mvvnl = 'Madhyanchal Vidyut Vitran Nigam Limited (MVVNL)';
assert.equal(billerField({ name: mvvnl, label: mvvnl }).label, 'Consumer Number');
assert.equal(billerField(null).label, 'Consumer Number');

const last4 = billerField({ label: 'Card Last Four Digit' });
assert.equal(cleanBillerInput(last4, '12a3456'), '1234');
assert.ok(billerInputValid(last4, '1234'));
assert.ok(!billerInputValid(last4, '123'));

const vehicle = billerField({ label: 'Vehicle Number' });
assert.equal(cleanBillerInput(vehicle, 'mh 12-ab 1234'), 'MH12AB1234');

const mobile = billerField({ label: 'Mobile Number' });
assert.ok(billerInputValid(mobile, '9876543210'));
assert.ok(!billerInputValid(mobile, '1234567890'));

assert.ok(billerInputValid(billerField({ label: 'Consumer Number' }), '100012345'));
assert.ok(!billerInputValid(billerField({ label: 'Consumer Number' }), '12'));

console.log('billerField: one input per biller, as the biller names it OK');
