<template>
  <q-page padding>
    <div class="row q-col-gutter-xl flex flex-center" style="min-height: 80vh;">
      <div class="col-auto">
        <q-card v-ripple class="dashboard-card cursor-pointer" @click="$router.push('/billing')">
          <q-card-section class="column flex-center text-center full-height">
            <q-icon name="point_of_sale" size="80px" class="text-primary q-mb-md" />
            <div class="text-h6">New Bill</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-auto">
        <q-card v-ripple class="dashboard-card cursor-pointer" @click="$router.push('/prices')">
          <q-card-section class="column flex-center text-center full-height">
            <q-icon name="list_alt" size="80px" class="text-primary q-mb-md" />
            <div class="text-h6">Price List</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-auto">
        <q-card v-ripple class="dashboard-card cursor-pointer" @click="$router.push('/history')">
          <q-card-section class="column flex-center text-center full-height">
            <q-icon name="history" size="80px" class="text-primary q-mb-md" />
            <div class="text-h6">Bill History</div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-auto">
        <q-card v-ripple class="dashboard-card cursor-pointer" @click="$router.push('/pending')">
          <q-card-section class="column flex-center text-center full-height">
            <q-icon name="pending_actions" size="80px" class="text-primary q-mb-md" />
            <div class="text-h6">Pending Bills</div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
// Main Dashboard
</script>

<style scoped>
.dashboard-card {
  width: 260px;
  height: 220px;
  border-radius: 16px;
  transition: transform 0.3s, box-shadow 0.3s;
}

.dashboard-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}
</style>
