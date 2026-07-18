import { createRouter, createWebHistory, type NavigationGuard, type RouteRecordRaw } from 'vue-router'
import { authReady, useAuth } from '@/stores/auth'
import { hasAnySenderId, senderIdsLoaded, senderIdsReady } from '@/stores/senderIds'

export const routes: RouteRecordRaw[] = [
    { path: '/', name: 'home', component: () => import('@/views/LandingView.vue'), meta: { public: true } },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/signup', name: 'signup', component: () => import('@/views/SignupView.vue'), meta: { public: true } },
    {
      path: '/app',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        { path: '', redirect: { name: 'compose' } },
        {
          path: 'compose',
          name: 'compose',
          component: () => import('@/features/compose/ComposeView.vue'),
          // Composing is pointless without a sender ID — you can't send. New accounts are
          // sent to request one first. Every other screen stays reachable.
          meta: { needsSenderId: true },
        },
        { path: 'campaigns', name: 'campaigns', component: () => import('@/views/CampaignsView.vue') },
        { path: 'sender-ids', name: 'senderIds', component: () => import('@/views/SenderIdsView.vue') },
        { path: 'reports', name: 'reports', component: () => import('@/views/ReportsView.vue') },
        { path: 'topup', name: 'topup', component: () => import('@/views/TopUpView.vue') },
      ],
    },
  { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
]

/** Exported so the access rules can be exercised against a memory-history router. */
export const guard: NavigationGuard = async (to) => {
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

  // Onboarding: an account with no sender ID at all can't send anything, so route it to
  // the request screen rather than dropping it on a compose form that dead-ends at step 3.
  // Only guards compose — the nav, top-up and history stay open, so this nudges, not traps.
  if (to.meta.needsSenderId && isAuthenticated.value) {
    await senderIdsReady()
    // Fail open: if the lookup failed we can't tell, and blocking compose on a network
    // blip would be worse than showing a form whose sender picker is empty.
    if (senderIdsLoaded() && !hasAnySenderId()) {
      return { name: 'senderIds', query: { onboarding: '1' } }
    }
  }
}

const router = createRouter({ history: createWebHistory(), routes })
router.beforeEach(guard)

export default router
