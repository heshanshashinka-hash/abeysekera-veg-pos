<template>
  <q-page padding>
    <q-card>
      <q-card-section>
        <div class="text-h6">Pending Bills</div>
      </q-card-section>

      <q-card-section>
        <q-table
          :rows="pendingBills"
          :columns="columns"
          row-key="id"
          flat
          bordered
          :loading="loading"
          :rows-per-page-options="[0]"
          :pagination="{ rowsPerPage: 0 }"
        >
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn dense flat label="Update Prices" @click="openUpdateDialog(props.row)" />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <q-dialog v-model="dialog" persistent>
      <q-card style="min-width: 600px; max-width: 1000px">
        <q-card-section>
          <div class="text-h6">
            Update Prices - Bill {{ selectedBill?.bill_number || selectedBill?.id }}
          </div>
          <div class="text-subtitle2">
            Department: {{ selectedBill?.department || '-' }} | PR:
            {{ selectedBill?.pr_number || '-' }}
          </div>
        </q-card-section>

        <q-card-section>
          <div v-if="itemsLoading" class="row items-center justify-center">
            <q-spinner-dots size="40px" />
          </div>

          <div v-else>
            <q-table
              :rows="items"
              :columns="itemColumns"
              row-key="id"
              flat
              bordered
              hide-pagination
              :rows-per-page-options="[0]"
            >
              <template v-slot:body-cell-unit_price="props">
                <q-td :props="props">
                  <q-input
                    type="number"
                    dense
                    outlined
                    v-model.number="props.row.unit_price"
                    @input="recalcRow(props.row)"
                  />
                </q-td>
              </template>
              <template v-slot:body-cell-total_price="props">
                <q-td :props="props">{{
                  (Number(props.row.qty) * Number(props.row.unit_price)).toFixed(2)
                }}</q-td>
              </template>
            </q-table>

            <div class="text-h6 text-right q-mt-md">
              Grand Total: Rs {{ computedGrandTotal.toFixed(2) }}
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup @click="closeDialog" />
          <q-btn
            color="secondary"
            icon="auto_fix_high"
            label="Auto-Fill Prices"
            @click="autoFillPrices"
            class="q-mr-sm"
          />
          <q-btn
            color="primary"
            label="Save & Complete"
            @click="saveAndComplete"
            :disable="items.length === 0"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'

const $q = useQuasar()

const pendingBills = ref([])
const loading = ref(false)

const dialog = ref(false)
const selectedBill = ref(null)
const items = ref([])
const itemsLoading = ref(false)

const columns = [
  {
    name: 'created',
    label: 'Date/Time',
    field: (row) => (row.created_at ? new Date(row.created_at).toLocaleString() : '-'),
    align: 'left',
  },
  { name: 'bill_number', label: 'Bill Number', field: 'bill_number', align: 'left' },
  { name: 'department', label: 'Department', field: 'department', align: 'left' },
  { name: 'pr_number', label: 'PR Number', field: 'pr_number', align: 'left' },
  { name: 'total', label: 'Total Amount', field: 'total_amount', align: 'right' },
  { name: 'actions', label: 'Actions', field: 'actions', sortable: false },
]

const itemColumns = [
  { name: 'item_name', label: 'Item', field: 'item_name' },
  { name: 'qty', label: 'Qty', field: 'qty', align: 'right' },
  { name: 'unit_price', label: 'Unit Price', field: 'unit_price', align: 'right' },
  { name: 'total_price', label: 'Total', field: 'total_price', align: 'right' },
]

const computedGrandTotal = computed(() => {
  return items.value.reduce((s, it) => s + Number(it.qty) * Number(it.unit_price || 0), 0)
})

async function fetchPending() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('veg_bills')
      .select('*')
      .eq('status', 'PENDING')
      .order('id', { ascending: false })
    if (error) throw error
    pendingBills.value = data || []
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Failed to load pending bills' })
  } finally {
    loading.value = false
  }
}

async function openUpdateDialog(row) {
  selectedBill.value = row
  dialog.value = true
  itemsLoading.value = true
  items.value = []
  try {
    const { data, error } = await supabase.from('veg_bill_items').select('*').eq('bill_id', row.id)
    if (error) throw error
    // ensure numeric fields
    items.value = (data || []).map((d) => ({
      ...d,
      unit_price: Number(d.unit_price) || 0,
      qty: Number(d.qty) || 0,
    }))
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Failed to load bill items' })
  } finally {
    itemsLoading.value = false
  }
}

function recalcRow(row) {
  // update total in-place (computed in template), no-op here but kept for reactivity
  row.total_price = Number(row.qty) * Number(row.unit_price || 0)
}

async function saveAndComplete() {
  try {
    $q.loading.show({ message: 'Saving updates...' })
    // prepare items with updated totals
    const itemsToSave = items.value.map((it) => ({
      ...it,
      total_price: Number(it.qty) * Number(it.unit_price || 0),
    }))
    // upsert items (will update by primary key id)
    const { error: itemsError } = await supabase.from('veg_bill_items').upsert(itemsToSave)
    if (itemsError) throw itemsError

    // update bill total and status
    const newTotal = computedGrandTotal.value
    const { error: billError } = await supabase
      .from('veg_bills')
      .update({ total_amount: newTotal, status: 'COMPLETED' })
      .eq('id', selectedBill.value.id)
    if (billError) throw billError

    $q.notify({ type: 'positive', message: 'Pending bill updated and completed' })
    dialog.value = false
    selectedBill.value = null
    items.value = []
    await fetchPending()
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Failed to save updates' })
  } finally {
    $q.loading.hide()
  }
}

async function autoFillPrices() {
  try {
    $q.loading.show({ message: 'Fetching current prices...' })
    const { data: latestPrices, error } = await supabase
      .from('veg_prices')
      .select('item_name, unit_price')
    if (error) throw error
    const priceMap = (latestPrices || []).reduce((m, p) => {
      m[p.item_name] = Number(p.unit_price)
      return m
    }, {})
    // update dialog items
    items.value.forEach((it) => {
      const latest = priceMap[it.item_name]
      if (latest !== undefined) {
        it.unit_price = latest
        it.total_price = Number(it.qty) * Number(it.unit_price || 0)
      }
    })
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Failed to auto-fill prices' })
  } finally {
    $q.loading.hide()
  }
}

function closeDialog() {
  dialog.value = false
  selectedBill.value = null
  items.value = []
}

onMounted(() => {
  fetchPending()
})
</script>
