<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { MailCheck } from 'lucide-vue-next'
import AuthShell from '@/components/AuthShell.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import { useAuth } from '@/stores/auth'
import { authErrorMessage } from '@/lib/firebase'

const route = useRoute()
const { sendPasswordReset } = useAuth()

// Prefilled from the sign-in screen so the user doesn't retype what they just typed.
const email = ref((route.query.email as string) ?? '')
const loading = ref(false)
const error = ref('')
// Once sent we swap the form for a confirmation panel — the same panel regardless of
// whether the address is registered, so this screen can't be used to probe for accounts.
const sent = ref(false)

async function submit() {
  error.value = ''
  if (!email.value.trim()) {
    error.value = 'Enter the email you signed up with.'
    return
  }
  loading.value = true
  try {
    await sendPasswordReset(email.value.trim())
    sent.value = true
  } catch (e) {
    error.value = authErrorMessage(e, 'Could not send the reset email. Please try again.')
  } finally {
    loading.value = false
  }
}

function resend() {
  sent.value = false
  submit()
}
</script>

<template>
  <AuthShell>
    <template v-if="!sent">
      <h2 class="text-2xl font-semibold tracking-tight">Reset your password</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Enter your email and we'll send you a link to set a new one.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <div class="grid gap-1.5">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" placeholder="you@company.com" autofocus />
        </div>

        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

        <Button type="submit" class="w-full" size="lg" :disabled="loading">
          {{ loading ? 'Sending…' : 'Send reset link' }}
        </Button>
      </form>
    </template>

    <template v-else>
      <div class="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MailCheck class="size-5" />
      </div>
      <h2 class="mt-4 text-2xl font-semibold tracking-tight">Check your inbox</h2>
      <p class="mt-2 text-sm text-muted-foreground">
        If an account exists for <strong class="text-foreground">{{ email.trim() }}</strong>, we've sent a link
        to reset your password. It expires in an hour — check your spam folder if it doesn't arrive.
      </p>
      <p class="mt-4 text-sm text-muted-foreground">
        Didn't get it?
        <button type="button" class="font-medium text-primary hover:underline" :disabled="loading" @click="resend">
          Send it again
        </button>
      </p>
    </template>

    <p class="mt-6 text-center text-sm text-muted-foreground">
      Remembered it?
      <RouterLink :to="{ name: 'login', query: email.trim() ? { email: email.trim() } : {} }" class="font-medium text-primary hover:underline">
        Back to sign in
      </RouterLink>
    </p>
  </AuthShell>
</template>
