import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'list', component: () => import('./views/LoanList.vue') },
  {
    path: '/loan/:fileId(\\d+)',
    name: 'detail',
    component: () => import('./views/LoanDetail.vue'),
    props: (route) => ({ fileId: Number(route.params.fileId) }),
  },
  { path: '/settings', name: 'settings', component: () => import('./views/Settings.vue') },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
