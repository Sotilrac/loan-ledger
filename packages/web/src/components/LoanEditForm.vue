<script setup lang="ts">
import { computed } from 'vue';
import { useLoanStore } from '../stores/loan.js';

const store = useLoanStore();

function updateRateEntry(index: number, field: 'effective_date' | 'annual_rate', raw: string) {
  store.updateDraft((d) => {
    const entry = d.loan.rate_schedule[index];
    if (!entry) return;
    if (field === 'effective_date') entry.effective_date = raw;
    else entry.annual_rate = Number(raw) / 100;
  });
}

function addRateEntry() {
  store.updateDraft((d) => {
    const last = d.loan.rate_schedule[d.loan.rate_schedule.length - 1];
    d.loan.rate_schedule.push({
      effective_date: last?.effective_date ?? d.loan.start_date,
      annual_rate: last?.annual_rate ?? d.loan.annual_rate,
    });
  });
}

function removeRateEntry(index: number) {
  store.updateDraft((d) => {
    if (d.loan.rate_schedule.length <= 1) return;
    d.loan.rate_schedule.splice(index, 1);
  });
}

function sortRateSchedule() {
  store.updateDraft((d) => {
    d.loan.rate_schedule.sort((a, b) => (a.effective_date < b.effective_date ? -1 : 1));
  });
}

function addExtraEntry() {
  store.updateDraft((d) => {
    const list = (d.loan.scheduled_extras ??= []);
    list.push({ start_date: d.loan.first_payment_date, amount: 100 });
  });
}

function removeExtraEntry(index: number) {
  store.updateDraft((d) => {
    if (!d.loan.scheduled_extras) return;
    d.loan.scheduled_extras.splice(index, 1);
  });
}

function updateExtraEntry(
  index: number,
  field: 'start_date' | 'end_date' | 'amount' | 'note',
  raw: string,
) {
  store.updateDraft((d) => {
    const list = d.loan.scheduled_extras;
    if (!list) return;
    const entry = list[index];
    if (!entry) return;
    if (field === 'start_date') entry.start_date = raw;
    else if (field === 'end_date') {
      if (raw === '') delete entry.end_date;
      else entry.end_date = raw;
    } else if (field === 'amount') entry.amount = Number(raw);
    else if (field === 'note') {
      if (raw === '') delete entry.note;
      else entry.note = raw;
    }
  });
}

function updatePropertyArray(value: string) {
  // Features: comma-separated input → string[]
  store.updateDraft((d) => {
    const features = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (features.length === 0) delete d.property.features;
    else d.property.features = features;
  });
}

function updatePropertyOptional<
  K extends
    | 'address'
    | 'year_built'
    | 'bedrooms'
    | 'bathrooms'
    | 'square_feet'
    | 'lot_size_sqft'
    | 'notes',
>(field: K, value: string | number | undefined) {
  store.updateDraft((d) => {
    if (value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value))) {
      delete d.property[field];
    } else {
      (d.property[field] as typeof value) = value;
    }
  });
}

/** Write into the active draft. Safe because isEditing guarantees draft exists. */
function updateProperty<K extends keyof NonNullable<typeof store.draft>['property']>(
  field: K,
  value: NonNullable<typeof store.draft>['property'][K],
) {
  store.updateDraft((d) => {
    d.property[field] = value;
  });
}

function updateValuation(field: 'amount' | 'as_of' | 'source', value: string | number) {
  store.updateDraft((d) => {
    if (field === 'amount') d.valuation.current.amount = Number(value);
    else if (field === 'as_of') d.valuation.current.as_of = String(value);
    else if (field === 'source') d.valuation.current.source = value as 'manual' | 'custom_url';
  });
}

function updateLoanField<K extends keyof NonNullable<typeof store.draft>['loan']>(
  field: K,
  value: NonNullable<typeof store.draft>['loan'][K],
) {
  store.updateDraft((d) => {
    d.loan[field] = value;
  });
}

const d = computed(() => store.draft);
</script>

<template>
  <form v-if="d" class="edit-form" @submit.prevent>
    <fieldset>
      <legend class="label">Property</legend>

      <div class="field">
        <label for="property-name">Name</label>
        <input
          id="property-name"
          type="text"
          :value="d.property.name"
          @input="updateProperty('name', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="row">
        <div class="field">
          <label for="purchase-date">Purchase date</label>
          <input
            id="purchase-date"
            type="date"
            :value="d.property.purchase_date"
            @input="updateProperty('purchase_date', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <label for="purchase-price">Purchase price</label>
          <input
            id="purchase-price"
            type="number"
            step="100"
            :value="d.property.purchase_price"
            @input="
              updateProperty('purchase_price', Number(($event.target as HTMLInputElement).value))
            "
          />
        </div>
        <div class="field">
          <label for="currency">Currency</label>
          <input
            id="currency"
            type="text"
            maxlength="3"
            :value="d.property.currency"
            @input="
              updateProperty('currency', ($event.target as HTMLInputElement).value.toUpperCase())
            "
          />
        </div>
      </div>
      <div class="field">
        <label for="property-address">Address</label>
        <input
          id="property-address"
          type="text"
          :value="d.property.address ?? ''"
          @input="updatePropertyOptional('address', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="row">
        <div class="field">
          <label for="year-built">Year built</label>
          <input
            id="year-built"
            type="number"
            min="1600"
            max="2200"
            :value="d.property.year_built ?? ''"
            @input="
              updatePropertyOptional(
                'year_built',
                ($event.target as HTMLInputElement).value === ''
                  ? undefined
                  : Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
        <div class="field">
          <label for="bedrooms">Bedrooms</label>
          <input
            id="bedrooms"
            type="number"
            min="0"
            step="0.5"
            :value="d.property.bedrooms ?? ''"
            @input="
              updatePropertyOptional(
                'bedrooms',
                ($event.target as HTMLInputElement).value === ''
                  ? undefined
                  : Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
        <div class="field">
          <label for="bathrooms">Bathrooms</label>
          <input
            id="bathrooms"
            type="number"
            min="0"
            step="0.5"
            :value="d.property.bathrooms ?? ''"
            @input="
              updatePropertyOptional(
                'bathrooms',
                ($event.target as HTMLInputElement).value === ''
                  ? undefined
                  : Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
        <div class="field">
          <label for="sqft">Square feet</label>
          <input
            id="sqft"
            type="number"
            min="0"
            :value="d.property.square_feet ?? ''"
            @input="
              updatePropertyOptional(
                'square_feet',
                ($event.target as HTMLInputElement).value === ''
                  ? undefined
                  : Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
        <div class="field">
          <label for="lot-sqft">Lot (sqft)</label>
          <input
            id="lot-sqft"
            type="number"
            min="0"
            :value="d.property.lot_size_sqft ?? ''"
            @input="
              updatePropertyOptional(
                'lot_size_sqft',
                ($event.target as HTMLInputElement).value === ''
                  ? undefined
                  : Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
      </div>
      <div class="field">
        <label for="features">Features (comma-separated)</label>
        <input
          id="features"
          type="text"
          placeholder="garage, fireplace, finished basement"
          :value="(d.property.features ?? []).join(', ')"
          @input="updatePropertyArray(($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="field">
        <label for="property-notes">Notes</label>
        <input
          id="property-notes"
          type="text"
          :value="d.property.notes ?? ''"
          @input="updatePropertyOptional('notes', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </fieldset>

    <fieldset>
      <legend class="label">Current valuation</legend>
      <div class="row">
        <div class="field">
          <label for="val-amount">Amount</label>
          <input
            id="val-amount"
            type="number"
            step="100"
            :value="d.valuation.current.amount"
            @input="updateValuation('amount', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <label for="val-date">As of</label>
          <input
            id="val-date"
            type="date"
            :value="d.valuation.current.as_of"
            @input="updateValuation('as_of', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <label for="val-source">Source</label>
          <select
            id="val-source"
            :value="d.valuation.current.source"
            @change="updateValuation('source', ($event.target as HTMLSelectElement).value)"
          >
            <option value="manual">Manual</option>
            <option value="custom_url">Custom URL</option>
          </select>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend class="label">Loan terms</legend>
      <div class="row">
        <div class="field">
          <label for="principal">Original principal</label>
          <input
            id="principal"
            type="number"
            step="100"
            :value="d.loan.principal"
            @input="updateLoanField('principal', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="field">
          <label for="term-months">Term (months)</label>
          <input
            id="term-months"
            type="number"
            step="1"
            min="1"
            :value="d.loan.term_months"
            @input="
              updateLoanField('term_months', Number(($event.target as HTMLInputElement).value))
            "
          />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label for="start-date">Start date</label>
          <input
            id="start-date"
            type="date"
            :value="d.loan.start_date"
            @input="updateLoanField('start_date', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <label for="first-payment">First payment</label>
          <input
            id="first-payment"
            type="date"
            :value="d.loan.first_payment_date"
            @input="
              updateLoanField('first_payment_date', ($event.target as HTMLInputElement).value)
            "
          />
        </div>
        <div class="field">
          <label for="payment-day">Payment day</label>
          <input
            id="payment-day"
            type="number"
            min="1"
            max="31"
            :value="d.loan.payment_day"
            @input="
              updateLoanField('payment_day', Number(($event.target as HTMLInputElement).value))
            "
          />
        </div>
        <div class="field">
          <label for="escrow">Monthly escrow</label>
          <input
            id="escrow"
            type="number"
            step="1"
            :value="d.loan.escrow_monthly"
            @input="
              updateLoanField('escrow_monthly', Number(($event.target as HTMLInputElement).value))
            "
          />
        </div>
        <div
          class="field"
          title="Overrides the computed P+I. Leave blank to let the amortization formula decide."
        >
          <label for="monthly-payment">Monthly payment (P+I)</label>
          <input
            id="monthly-payment"
            type="number"
            step="0.01"
            placeholder="Auto"
            :value="d.loan.monthly_payment ?? ''"
            @input="
              updateLoanField(
                'monthly_payment',
                ($event.target as HTMLInputElement).value === ''
                  ? undefined
                  : Number(($event.target as HTMLInputElement).value),
              )
            "
          />
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend class="label">Rate schedule</legend>
      <table class="rate-table">
        <thead>
          <tr>
            <th>Effective date</th>
            <th class="num">Annual rate</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in d.loan.rate_schedule" :key="index">
            <td>
              <input
                type="date"
                :value="entry.effective_date"
                @input="
                  updateRateEntry(
                    index,
                    'effective_date',
                    ($event.target as HTMLInputElement).value,
                  )
                "
                @change="sortRateSchedule"
              />
            </td>
            <td class="num">
              <input
                type="number"
                step="0.01"
                min="0"
                max="30"
                :value="(entry.annual_rate * 100).toFixed(3)"
                @input="
                  updateRateEntry(index, 'annual_rate', ($event.target as HTMLInputElement).value)
                "
              />
              <span class="suffix">%</span>
            </td>
            <td>
              <button
                type="button"
                class="remove"
                :disabled="d.loan.rate_schedule.length <= 1"
                @click="removeRateEntry(index)"
              >
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="add" @click="addRateEntry">+ Add rate entry</button>
    </fieldset>

    <fieldset>
      <legend class="label">Scheduled extra principal</legend>
      <p class="hint">
        Recurring amounts you commit to paying on top of the scheduled payment. Leave
        <em>End date</em> blank to run forever.
      </p>
      <table class="rate-table">
        <thead>
          <tr>
            <th>Start date</th>
            <th>End date</th>
            <th class="num">Amount per month</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in d.loan.scheduled_extras ?? []" :key="index">
            <td>
              <input
                type="date"
                :value="entry.start_date"
                @input="
                  updateExtraEntry(index, 'start_date', ($event.target as HTMLInputElement).value)
                "
              />
            </td>
            <td>
              <input
                type="date"
                :value="entry.end_date ?? ''"
                @input="
                  updateExtraEntry(index, 'end_date', ($event.target as HTMLInputElement).value)
                "
              />
            </td>
            <td class="num">
              <input
                type="number"
                step="1"
                min="1"
                :value="entry.amount"
                @input="
                  updateExtraEntry(index, 'amount', ($event.target as HTMLInputElement).value)
                "
              />
            </td>
            <td>
              <input
                type="text"
                placeholder="optional"
                :value="entry.note ?? ''"
                @input="updateExtraEntry(index, 'note', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td>
              <button type="button" class="remove" @click="removeExtraEntry(index)">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
      <button type="button" class="add" @click="addExtraEntry">+ Add recurring extra</button>
    </fieldset>

    <p class="note">
      Payments are edited via CSV import (Phase 6). Derived values (equity, projected payoff,
      schedule rows) update live as you type.
    </p>
  </form>
</template>

<style scoped>
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  background: var(--ll-paper-sunk);
  padding: 1.5rem 2rem;
  border-radius: 4px;
}

fieldset {
  border: none;
  padding: 0;
  margin: 0;
}

legend {
  margin: 0 0 0.75rem;
  padding: 0;
}

.label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
}

.row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.75rem;
}

label {
  font-size: 0.75rem;
  color: var(--ll-ink-muted);
  letter-spacing: 0.04em;
}

input,
select {
  font-family: var(--ll-font-sans);
  font-size: 1rem;
  padding: 0.5rem 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--ll-ink-faint);
  color: var(--ll-ink);
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
  transition: border-color 120ms;
}

input:focus,
select:focus {
  outline: none;
  border-bottom: 2px solid var(--ll-accent);
  padding-bottom: calc(0.5rem - 1px);
}

.note,
.hint {
  font-family: var(--ll-font-serif);
  font-style: italic;
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
  margin: 0 0 0.75rem;
}

.rate-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--ll-font-sans);
  font-size: 0.875rem;
}

.rate-table th {
  text-align: left;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  padding: 0.5rem 0.5rem 0.5rem 0;
}

.rate-table td {
  padding: 0.25rem 0.5rem 0.25rem 0;
  vertical-align: middle;
}

.rate-table .num {
  text-align: right;
  white-space: nowrap;
}

.rate-table .num input {
  text-align: right;
  max-width: 100px;
}

.rate-table .suffix {
  color: var(--ll-ink-muted);
  font-size: 0.875rem;
  padding-left: 0.25rem;
}

button.add {
  margin-top: 0.75rem;
  background: transparent;
  border: none;
  color: var(--ll-accent);
  font-family: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.5rem 0;
}

button.add:hover {
  color: var(--ll-accent-hover);
  text-decoration: underline;
}

button.remove {
  background: transparent;
  border: none;
  color: var(--ll-negative);
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
}

button.remove:hover:not(:disabled) {
  background: var(--ll-negative-soft);
}

button.remove:disabled {
  color: var(--ll-ink-faint);
  cursor: not-allowed;
}
</style>
