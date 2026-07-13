<template>
  <q-page padding class="flex flex-center bg-grey-2">
    <q-card style="width: 100%; max-width: 500px" class="shadow-2 border-radius-lg">
      <q-card-section class="bg-primary text-white">
        <div class="text-h6 text-center">Add New Vegetable/Item</div>
      </q-card-section>

      <q-card-section class="q-pt-lg">
        <q-form @submit.prevent="saveItem">
          <div class="q-gutter-md">
            <q-input
              ref="nameInput"
              v-model="newItem.name"
              label="Item Name"
              outlined
              dense
              autofocus
              @keyup.enter="priceInput.focus()"
              :rules="[val => !!val || 'Item name is required']"
            />
            <q-select
              v-model="newItem.unit"
              :options="['KG', 'Nos', 'Bundle', 'Pack']"
              label="Unit"
              outlined
              dense
            />
            <q-input
              ref="priceInput"
              v-model.number="newItem.price"
              type="number"
              label="Initial Price"
              outlined
              dense
              @keyup.enter="saveItem"
              :rules="[val => val !== null && val !== '' || 'Price is required']"
            />
          </div>
          <div class="row justify-between q-mt-lg">
            <q-btn flat color="primary" label="Back to Price List" @click="$router.push('/prices')" />
            <q-btn color="positive" label="Save Item" type="submit" />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { supabase } from 'src/boot/supabase'

const $q = useQuasar()
const nameInput = ref(null)
const priceInput = ref(null)

const newItem = ref({
  name: '',
  unit: 'KG',
  price: ''
})

const saveItem = async () => {
  if (!newItem.value.name || newItem.value.price === null || newItem.value.price === '') {
    return
  }
  
  try {
    $q.loading.show()
    const { error } = await supabase
      .from('veg_prices')
      .insert([{ 
        item_name: `${newItem.value.name.trim()} (${newItem.value.unit})`, 
        unit_price: newItem.value.price 
      }])
      
    if (error) throw error
    
    $q.notify({ type: 'positive', message: 'Item Added Successfully' })
    
    // Clear fields
    newItem.value = { name: '', unit: 'KG', price: '' }
    
    if (nameInput.value) nameInput.value.resetValidation()
    if (priceInput.value) priceInput.value.resetValidation()
    
    // Focus back on the name input for continuous entry
    if (nameInput.value) {
      nameInput.value.focus()
    }
  } catch (error) {
    console.error(error)
    $q.notify({ type: 'negative', message: 'Error adding item' })
  } finally {
    $q.loading.hide()
  }
}
</script>
