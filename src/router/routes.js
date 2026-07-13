const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'billing', component: () => import('pages/BillingPage.vue') },
      { path: 'prices', component: () => import('pages/PriceListPage.vue') },
      { path: 'history', component: () => import('pages/BillHistoryPage.vue') },
      { path: 'pending', component: () => import('pages/PendingBillsPage.vue') },
      { path: 'add-item', component: () => import('pages/AddNewItemPage.vue') },
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
