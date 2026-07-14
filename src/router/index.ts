import { createRouter, createWebHistory } from 'vue-router'
import { authReady, useAuth } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/LandingView.vue'), meta: { public: true } },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/signup', name: 'signup', component: () => import('@/views/SignupView.vue'), meta: { public: true } },
    {
      path: '/app',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', redirect: { name: 'compose' } },
        { path: 'compose', name: 'compose', component: () => import('@/features/compose/ComposeView.vue') },
        { path: 'campaigns', name: 'campaigns', component: () => import('@/views/CampaignsView.vue') },
        { path: 'sender-ids', name: 'senderIds', component: () => import('@/views/SenderIdsView.vue') },
        { path: 'reports', name: 'reports', component: () => import('@/views/ReportsView.vue') },
        { path: 'topup', name: 'topup', component: () => import('@/views/TopUpView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

router.beforeEach(async (to) => {
  // Wait for Firebase to restore any existing session before deciding on access,
  // otherwise a hard refresh on a protected route bounces the user to /login.
  await authReady()
  const { isAuthenticated } = useAuth()
  // Protected routes require a session.
  if (!to.meta.public && !isAuthenticated.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // Already signed in? Skip the auth screens (but the landing page stays open to all).
  if ((to.name === 'login' || to.name === 'signup') && isAuthenticated.value) {
    return { name: 'compose' }
  }
})

export default router
