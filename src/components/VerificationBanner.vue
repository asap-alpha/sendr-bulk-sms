<script setup lang="ts">
import { ref } from 'vue'
import { MailWarning, Check } from 'lucide-vue-next'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/api'

// Nudges an unverified user to confirm their email. Hidden once verified (Google sign-ups
// are verified from the start, so they never see it). Verifying here keeps tailoredflow —
// which shares this identity and gates on email verification — friction-free.
const { user, emailVerified, resendVerification, refreshVerification } = useAuth()

const sending = ref(false)
const checking = ref(false)
const note = ref('')
const error = ref('')

async function resend() {
  if (sending.value) return
  sending.value = true
  note.value = ''
  error.value = ''
  try {
    await resendVerification()
    note.value = 'Verification email sent — check your inbox (and spam).'
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Could not send the email. Please try again.'
  } finally {
    sending.value = false
  }
}

async function check() {
  if (checking.value) return
  checking.value = true
  note.value = ''
  error.value = ''
  try {
    const ok = await refreshVerification()
    if (!ok) note.value = "Not verified yet — click the link in the email, then check again."
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <div v-if="user && !emailVerified" class="border-b border-amber-300 bg-amber-50 text-amber-900">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-sm">
      <MailWarning class="size-4 shrink-0" />
      <span class="min-w-0">
        Verify <strong>{{ user.email }}</strong> to secure your account.
        <span v-if="note" class="text-amber-700">· {{ note }}</span>
        <span v-if="error" class="text-destructive">· {{ error }}</span>
      </span>
      <div class="ms-auto flex items-center gap-2">
        <button
          class="rounded-md px-2.5 py-1 text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
          :disabled="checking"
          @click="check"
        >
          <span v-if="checking">Checking…</span>
          <span v-else class="inline-flex items-center gap-1"><Check class="size-3.5" /> I've verified</span>
        </button>
        <button
          class="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
          :disabled="sending"
          @click="resend"
        >
          {{ sending ? 'Sending…' : 'Resend email' }}
        </button>
      </div>
    </div>
  </div>
</template>
