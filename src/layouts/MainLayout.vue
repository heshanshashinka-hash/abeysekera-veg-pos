<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>Abeysekera Suppliers</q-toolbar-title>
        <q-space />
        <q-btn flat icon="home" label="Return to Home" to="/" v-if="$route.path !== '/'" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
