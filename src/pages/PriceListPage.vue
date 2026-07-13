<template>
  <q-page padding>
    <q-card style="max-width: 900px; margin: 0 auto;">
      <q-card-section class="row items-center justify-between">
        <div class="text-h6">Price List Management</div>
        <div>
          <q-btn color="positive" label="Save All Changes" @click="saveAllPrices" class="q-mr-sm" />
          <q-btn outline color="primary" label="Add New Item" @click="$router.push('/add-item')" />
        </div>
      </q-card-section>
      <q-card-section>
        <q-table
          class="my-sticky-header-table"
          :rows="prices"
          :columns="columns"
          row-key="id"
          flat
          bordered
          hide-pagination
          :rows-per-page-options="[0]"
          :pagination="{ rowsPerPage: 0 }"
          table-header-class="pos-table-header"
        >
          <template v-slot:body-cell-index="props">
            <q-td :props="props">
              <span class="text-weight-bold text-grey-7">{{ props.rowIndex + 1 }}</span>
            </q-td>
          </template>
          <template v-slot:body-cell-unit_price="props">
            <q-td :props="props">
              <div class="row justify-start">
                <q-input
                  type="number"
                  v-model.number="props.row.unit_price"
                  dense
                  outlined
                  style="max-width: 150px"
                  input-class="text-left text-h6"
                  @focus="$event.target.select()"
                />
              </div>
            </q-td>
          </template>
          <template v-slot:body-cell-actions="props">
            <q-td :props="props" align="center">
              <q-btn flat round dense color="negative" icon="delete" @click="confirmDelete(props.row)" />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'

// මෙන්න මේක තමයි AI එකට දාගන්න බැරි වෙච්ච කෑල්ල!
const $q = useQuasar()

const prices = ref([])

const columns = [
  { name: 'index', label: '#', align: 'center', style: 'width: 60px' },
  { name: 'item_name', label: 'PRODUCT', field: 'item_name', align: 'left', classes: 'text-subtitle1 text-weight-medium' },
  { name: 'unit_price', label: 'PRICE', field: 'unit_price', align: 'left' },
  { name: 'actions', label: 'ACTIONS', align: 'center' },
]

const fetchPrices = async () => {
  try {
    $q.loading.show()
    const { data, error } = await supabase.from('veg_prices').select('*').order('item_name')
    if (error) throw error
    prices.value = data
  } catch (error) {
    console.error(error)
  } finally {
    $q.loading.hide()
  }
}

onMounted(() => {
  fetchPrices()
})

const confirmDelete = (row) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: `Are you sure you want to delete ${row.item_name}?`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      $q.loading.show()
      
      const pkField = row.id ? 'id' : 'item_name'
      const pkValue = row.id || row.item_name
      
      const { error } = await supabase.from('veg_prices').delete().eq(pkField, pkValue)
      
      if (error) {
        console.error("Delete Error:", error);
        $q.notify({ 
          type: 'negative', 
          message: 'Cannot delete item. It might be used in previous bills.', 
          caption: error.message 
        });
      } else {
        $q.notify({ type: 'positive', message: 'Item deleted successfully' });
        // Re-fetch the data here
        fetchPrices(); 
      }
    } catch (err) {
      console.error(err)
      $q.notify({ type: 'negative', message: 'An unexpected error occurred while deleting' })
    } finally {
      $q.loading.hide()
    }
  })
}

const saveAllPrices = async () => {
  try {
    $q.loading.show({ message: 'Saving all prices...' })
    const { error } = await supabase.from('veg_prices').upsert(prices.value)
    if (error) throw error
    $q.notify({ type: 'positive', message: 'All prices saved' })
    fetchPrices()
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Error saving prices' })
  } finally {
    $q.loading.hide()
  }
}
</script>

<style lang="scss" scoped>
.pos-table-header th {
  background-color: #e8f5e9 !important; /* light green */
  font-weight: bold !important;
  font-size: 1.1em !important;
}

.my-sticky-header-table {
  /* Set a fixed height for the table container */
  height: 78vh;

  .q-table__top,
  .q-table__bottom,
  thead tr:first-child th {
    /* Background color for the sticky header */
    background-color: #f2f2f2;
  }

  thead tr th {
    position: sticky;
    z-index: 1;
  }

  thead tr:first-child th {
    top: 0;
  }

  tbody td {
    font-size: 16px !important;
    font-weight: 500;
  }

  /* Prevent the table from overflowing the card */
  &.q-table--flat {
    box-shadow: none;
  }
}
</style>
