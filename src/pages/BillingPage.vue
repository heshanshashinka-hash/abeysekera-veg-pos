<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-5">
        <q-card>
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">Vegetable POS - Billing</div>
          </q-card-section>
          <q-card-section class="q-gutter-md">
            <div class="q-mb-md">
              <q-btn-toggle
                v-model="billType"
                :options="[
                  { label: 'With Price', value: 'with_price' },
                  { label: 'Without Price', value: 'without_price' },
                ]"
                class="full-width"
              />
            </div>
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input v-model="billNumber" readonly bg-color="grey-2" label="Bill Number" />
              </div>
              <div class="col-6">
                <q-input v-model="hotelName" readonly bg-color="grey-2" label="Hotel Name" />
              </div>
              <div class="col-6">
                <q-select v-model="department" :options="deptOptions" label="Department" />
              </div>
              <div class="col-6">
                <q-input v-model="prNumber" label="PR Number (Optional)" />
              </div>
            </div>

            <q-separator class="q-my-md" />

            <q-select
              v-model="selectedVeg"
              :options="filteredOptions"
              option-label="item_name"
              label="Vegetable"
              outlined
              dense
              use-input
              hide-selected
              fill-input
              :input-debounce="0"
              @filter="filterVegetables"
              ref="vegSelectRef"
              @update:model-value="onVegSelect"
            />
            <div class="row q-col-gutter-sm">
              <div class="col-6">
                <q-input v-model.number="qty" type="number" label="Qty (Kg)" outlined dense />
              </div>
              <div class="col-6" v-if="billType === 'with_price'">
                <q-input
                  v-model.number="unitPrice"
                  type="number"
                  label="Unit Price (Rs)"
                  outlined
                  dense
                />
              </div>
            </div>
            <q-btn
              color="primary"
              icon="add"
              label="ADD TO BILL"
              class="full-width"
              @click="addItem"
              :disable="
                !selectedVeg ||
                !qty ||
                (billType === 'with_price' && (unitPrice === '' || unitPrice === null))
              "
            />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-7">
        <q-card>
          <q-card-section>
            <div class="text-h6">Cart</div>
          </q-card-section>
          <q-card-section>
            <q-table
              :rows="billItems"
              :columns="columns"
              row-key="item_name"
              flat
              bordered
              hide-pagination
              :rows-per-page-options="[0]"
            >
              <template v-slot:body-cell-actions="props">
                <q-td :props="props">
                  <q-btn
                    flat
                    round
                    color="negative"
                    icon="delete"
                    size="sm"
                    @click="removeItem(props.rowIndex)"
                  />
                </q-td>
              </template>
            </q-table>
            <div v-if="billType === 'with_price'" class="text-h6 text-right q-mt-md">
              Grand Total: Rs {{ grandTotal.toFixed(2) }}
            </div>
            <div class="text-right q-mt-sm">
              <q-btn
                color="negative"
                label="SAVE & PRINT BILL"
                @click="saveAndPrint"
                :disable="billItems.length === 0 || !hotelName"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'

// මෙන්න මේක තමයි AI එකට දාගන්න බැරි වෙච්ච කෑල්ල!
const $q = useQuasar()

const billNumber = ref('BILL-1001')
const hotelName = ref('Grand Hotel')
const department = ref('Main Kitchen')
const deptOptions = ['Main Kitchen', 'Bar', 'Staff']
const prNumber = ref('')
const billType = ref('with_price')
const selectedVeg = ref(null)
const qty = ref('')
const unitPrice = ref('')
const billItems = ref([])
const vegItemsFromDB = ref([])
const vegSelectRef = ref(null)
const filteredOptions = ref([])

const filterVegetables = (val, update) => {
  if (val === '') {
    update(() => {
      filteredOptions.value = vegItemsFromDB.value
    })
    return
  }

  update(() => {
    const needle = val.toLowerCase()
    filteredOptions.value = vegItemsFromDB.value.filter(
      v => v.item_name.toLowerCase().indexOf(needle) > -1
    )
  })
}

const columns = computed(() => {
  const cols = [
    { name: 'item', label: 'Item', field: 'item_name', align: 'left' },
    { name: 'qty', label: 'Qty', field: 'qty', align: 'center' },
  ]
  if (billType.value === 'with_price') {
    cols.push({ name: 'price', label: 'Price', field: 'unit_price', align: 'center' })
    cols.push({ name: 'total', label: 'Total', field: 'total_price', align: 'right' })
  }
  cols.push({ name: 'actions', label: 'Action', field: 'actions', align: 'center' })
  return cols
})

const grandTotal = computed(() => billItems.value.reduce((sum, item) => sum + item.total_price, 0))

onMounted(async () => {
  try {
    $q.loading.show()
    const { data, error } = await supabase.from('veg_prices').select('*').order('item_name')
    if (error) throw error
    vegItemsFromDB.value = data
    filteredOptions.value = data
  } catch (error) {
    console.error(error)
  } finally {
    $q.loading.hide()
  }
})

const onVegSelect = (val) => {
  if (!val) return
  if (typeof val === 'object') {
    unitPrice.value = val.unit_price
  } else {
    const found = vegItemsFromDB.value.find((v) => v.item_name === val)
    if (found) unitPrice.value = found.unit_price
  }
}

const addItem = () => {
  if (!selectedVeg.value || !qty.value) return
  const itemName = typeof selectedVeg.value === 'object' ? selectedVeg.value.item_name : selectedVeg.value
  let price = 0
  let total = 0
  if (billType.value === 'with_price') {
    price = Number(unitPrice.value) || 0
    total = Number(qty.value) * price
  }
  billItems.value.push({
    item_name: itemName,
    qty: Number(qty.value),
    unit_price: price,
    total_price: total,
  })
  selectedVeg.value = null
  qty.value = ''
  unitPrice.value = ''
  vegSelectRef.value?.focus()
}

const removeItem = (index) => billItems.value.splice(index, 1)

const saveAndPrint = async () => {
  try {
    $q.loading.show({ message: 'Saving...' })
    const { data: billData, error: billError } = await supabase
      .from('veg_bills')
      .insert([
        {
          hotel_name: hotelName.value,
          bill_number: billNumber.value,
          department: department.value,
          pr_number: prNumber.value || null,
          total_amount: grandTotal.value,
          status: billType.value === 'with_price' ? 'COMPLETED' : 'PENDING',
        },
      ])
      .select()
    if (billError) throw billError
    const billId = billData[0].id
    const itemsToInsert = billItems.value.map((item) => ({ ...item, bill_id: billId }))
    const { error: itemsError } = await supabase.from('veg_bill_items').insert(itemsToInsert)
    if (itemsError) throw itemsError

    const bill = {
      bill_number: billNumber.value,
      hotel_name: hotelName.value,
      department: department.value,
      pr_number: prNumber.value,
      total_amount: grandTotal.value
    }
    const itemsList = billItems.value
    const formatNumber = (n) => Number(n || 0).toFixed(2)
    const created = new Date().toLocaleString()

    const rowsHtml = itemsList
      .map(
        (it) =>
          `<tr>
            <td>${it.item_name}</td>
            <td>${Number(it.qty || 0)}</td>
            <td>${formatNumber(it.unit_price)}</td>
            <td>${formatNumber(it.total_price)}</td>
          </tr>`
      )
      .join('')

    const htmlContent = `<!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice - ${bill.bill_number || bill.id}</title>
      <style>
        @page { margin: 0; }
        body { margin: 0; padding: 10px 5px; }
        .container { max-width: 78mm; margin: 0 auto; font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; }
        .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
        .header h1 { font-size: 16px; margin: 0; font-weight: bold; }
        .header p { margin: 2px 0; }
        .info-section { border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
        .info-section div { margin: 2px 0; display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
        th, td { padding: 4px 0; text-align: right; }
        th:first-child, td:first-child { text-align: left; }
        .total-row td { font-weight: bold; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
        .sig-block { width: 40%; text-align: center; }
        .sig-line { border-top: 1px solid #000; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ABEYSEKERA SUPPLIERS</h1>
          <p>LankaFruit</p>
          <p>[Address]</p>
          <p>[Phone]</p>
        </div>

        <div class="info-section">
          <div><span>Bill No:</span> <span>${bill.bill_number || bill.id}</span></div>
          <div><span>Date:</span> <span>${created}</span></div>
          <div><span>Hotel:</span> <span>${bill.hotel_name || '-'}</span></div>
          <div><span>Dept:</span> <span>${bill.department || '-'}</span></div>
          <div><span>PR No:</span> <span>${bill.pr_number || '-'}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="3" style="text-align: right; padding-right: 10px;">Grand Total</td>
              <td>${formatNumber(bill.total_amount)}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-block">
            <div class="sig-line"></div>
            <div>Supplied By</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div>Received By</div>
          </div>
        </div>
      </div>
    </body>
    </html>`

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(htmlContent)
      doc.close()
      
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch (e) {
          console.error(e)
          $q.notify({ type: 'negative', message: 'Print failed' })
        } finally {
          setTimeout(() => {
            try {
              document.body.removeChild(iframe)
            } catch {
              /* ignore */
            }
          }, 500)
        }
      }, 250)
    }

    $q.notify({ type: 'positive', message: 'Bill Saved & Printed!' })
    billItems.value = []
    prNumber.value = ''
  } catch (error) {
    console.error(error)
    $q.notify({ type: 'negative', message: 'Error saving bill' })
  } finally {
    $q.loading.hide()
  }
}
</script>
