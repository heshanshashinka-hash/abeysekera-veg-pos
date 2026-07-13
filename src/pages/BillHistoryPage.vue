<template>
  <q-page padding>
    <q-card>
      <q-card-section>
        <div class="text-h6">Bill History</div>
      </q-card-section>

      <q-card-section>
        <q-btn
          color="warning"
          icon="autorenew"
          label="Recalculate Selected Bills"
          @click="recalculateSelected"
          :disable="selectedBills.length === 0"
          class="q-mb-md"
        />
        <q-table
          :rows="bills"
          :columns="columns"
          row-key="id"
          flat
          bordered
          :loading="loading"
          selection="multiple"
          v-model:selected="selectedBills"
        >
          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <q-btn dense flat label="View Items" @click="viewItems(props.row)" />
              <q-btn
                flat
                round
                color="info"
                icon="print"
                @click="printBill(props.row)"
                size="sm"
                tooltip="Print/Download"
                class="q-ml-sm"
              />
              <q-btn
                flat
                round
                color="positive"
                icon="file_download"
                @click="downloadBill(props.row)"
                size="sm"
                class="q-ml-sm"
                tooltip="Download PDF"
              />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>

    <q-dialog v-model="dialog" persistent>
      <q-card style="min-width: 500px; max-width: 900px">
        <q-card-section>
          <div class="text-h6">
            Items for Bill: {{ selectedBill?.bill_number || selectedBill?.id }}
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
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup @click="closeDialog" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'

const $q = useQuasar()

const bills = ref([])
const loading = ref(false)
const selectedBills = ref([])

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

async function fetchBills() {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('veg_bills')
      .select('*')
      .eq('status', 'COMPLETED')
      .order('id', { ascending: false })
    if (error) throw error
    bills.value = data || []
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Failed to load bills' })
  } finally {
    loading.value = false
  }
}

async function viewItems(row) {
  selectedBill.value = row
  dialog.value = true
  itemsLoading.value = true
  items.value = []
  try {
    const { data, error } = await supabase.from('veg_bill_items').select('*').eq('bill_id', row.id)
    if (error) throw error
    items.value = data || []
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Failed to load bill items' })
  } finally {
    itemsLoading.value = false
  }
}

async function recalculateSelected() {
  if (!selectedBills.value || selectedBills.value.length === 0) return
  try {
    $q.loading.show({ message: 'Recalculating selected bills...' })
    const { data: latestPrices, error: latestError } = await supabase
      .from('veg_prices')
      .select('item_name, unit_price')
    if (latestError) throw latestError
    const priceMap = (latestPrices || []).reduce((m, p) => {
      m[p.item_name] = Number(p.unit_price)
      return m
    }, {})

    for (const bill of selectedBills.value) {
      // fetch items for this bill
      const { data: itemsData, error: itemsErr } = await supabase
        .from('veg_bill_items')
        .select('*')
        .eq('bill_id', bill.id)
      if (itemsErr) {
        console.error(itemsErr)
        $q.notify({ type: 'negative', message: `Failed to fetch items for bill ${bill.id}` })
        continue
      }

      const updatedItems = (itemsData || []).map((it) => {
        const latest = priceMap[it.item_name]
        const unit_price = latest !== undefined ? Number(latest) : Number(it.unit_price || 0)
        const total_price = Number(it.qty || 0) * unit_price
        return { ...it, unit_price, total_price }
      })

      // upsert updated items
      const { error: upsertErr } = await supabase.from('veg_bill_items').upsert(updatedItems)
      if (upsertErr) {
        console.error(upsertErr)
        $q.notify({ type: 'negative', message: `Failed to update items for bill ${bill.id}` })
        continue
      }

      // compute new total
      const newTotal = updatedItems.reduce((s, it) => s + Number(it.total_price || 0), 0)
      const { error: billErr } = await supabase
        .from('veg_bills')
        .update({ total_amount: newTotal })
        .eq('id', bill.id)
      if (billErr) {
        console.error(billErr)
        $q.notify({ type: 'negative', message: `Failed to update bill total for ${bill.id}` })
        continue
      }
    }

    $q.notify({ type: 'positive', message: 'Selected bills recalculated' })
    selectedBills.value = []
    await fetchBills()
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Error recalculating bills' })
  } finally {
    $q.loading.hide()
  }
}

function closeDialog() {
  dialog.value = false
  selectedBill.value = null
  items.value = []
}

async function printBill(bill) {
  if (!bill) return
  $q.loading.show({ message: 'Preparing Bill...' })
  try {
    const { data: itemsData, error } = await supabase
      .from('veg_bill_items')
      .select('*')
      .eq('bill_id', bill.id)
      .order('id', { ascending: true })
    if (error) throw error

    const itemsList = itemsData || []

    const formatNumber = (n) => Number(n || 0).toFixed(2)

    const created = bill.created_at ? new Date(bill.created_at).toLocaleString() : ''

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

    const html = `<!doctype html>
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
    if (!doc) throw new Error('Unable to access iframe document')
    doc.open()
    doc.write(html)
    doc.close()

    // give the iframe a moment to load content
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (e) {
        console.error(e)
        $q.notify({ type: 'negative', message: 'Print failed' })
      } finally {
        // remove iframe after a short delay to allow print to start
        setTimeout(() => {
          try {
            document.body.removeChild(iframe)
          } catch {
            /* ignore */
          }
        }, 500)
      }
    }, 250)
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Failed to prepare bill for printing' })
  } finally {
    $q.loading.hide()
  }
}

const downloadBill = async (bill) => {
  if (!bill) return
  $q.loading.show({ message: 'Downloading PDF...' })
  try {
    const { data: itemsData, error } = await supabase
      .from('veg_bill_items')
      .select('*')
      .eq('bill_id', bill.id)
      .order('id', { ascending: true })
    if (error) throw error

    const itemsList = itemsData || []
    const formatNumber = (n) => Number(n || 0).toFixed(2)
    const created = bill.created_at ? new Date(bill.created_at).toLocaleString() : ''

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

    // load html2pdf if missing
    if (!window.html2pdf) {
      await new Promise((resolve) => {
        const script = document.createElement('script')
        script.src =
          'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
        script.onload = resolve
        document.head.appendChild(script)
      })
    }

    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent

    await window
      .html2pdf()
      .set({
        margin: 10,
        filename: `${bill.bill_number || bill.id}.pdf`,
        html2canvas: { scale: 2 },
      })
      .from(tempDiv)
      .save()
  } catch (error) {
    console.error(error)
    $q.notify({ type: 'negative', message: 'Error downloading PDF' })
  } finally {
    $q.loading.hide()
  }
}

onMounted(() => {
  fetchBills()
})
</script>
