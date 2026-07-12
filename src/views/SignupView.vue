<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import GoogleButton from '@/components/GoogleButton.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import PasswordInput from '@/components/ui/PasswordInput.vue'
import Label from '@/components/ui/Label.vue'
import { useAuth } from '@/stores/auth'
import { authErrorMessage, isEmailInUse } from '@/lib/firebase'

const router = useRouter()
const { signup, loginWithGoogle } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const googleLoading = ref(false)
const error = ref('')
// Set when the email is already registered under the shared Cheqam identity — we show a
// "sign in instead" banner rather than a dead-end error, since the account may have been
// created on any of our products.
const existingAccount = ref(false)

function goSignIn() {
  router.push({ name: 'login', query: { email: email.value.trim() } })
}

async function submit() {
  error.value = ''
  existingAccount.value = false
  if (!name.value.trim() || !email.value.trim() || !password.value) {
    error.value = 'Fill in every field to continue.'
    return
  }
  loading.value = true
  try {
    await signup(name.value.trim(), email.value.trim(), password.value)
    router.push({ name: 'compose' })
  } catch (e) {
    if (isEmailInUse(e)) existingAccount.value = true
    else error.value = authErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function google() {
  error.value = ''
  googleLoading.value = true
  try {
    await loginWithGoogle()
    router.push({ name: 'compose' })
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    googleLoading.value = false
  }
}
</script>

<template>
  <AuthShell>
    <h2 class="text-2xl font-semibold tracking-tight">Create your account</h2>
    <p class="mt-1 text-sm text-muted-foreground">Send your first bulk SMS campaign in minutes.</p>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <div class="grid gap-1.5">
        <Label for="name">Full name</Label>
        <Input id="name" v-model="name" placeholder="Ama Mensah" />
      </div>
      <div class="grid gap-1.5">
        <Label for="email">Email</Label>
        <Input id="email" v-model="email" type="email" placeholder="you@company.com" />
      </div>
      <div class="grid gap-1.5">
        <Label for="password">Password</Label>
        <PasswordInput id="password" v-model="password" placeholder="Create a password" />
      </div>

      <div v-if="existingAccount" class="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <p class="text-foreground">
          This email is already registered with <strong>Cheqam</strong> — one login works across all our products.
        </p>
        <button type="button" class="mt-1 font-medium text-primary hover:underline" @click="goSignIn">
          Sign in to continue
        </button>
      </div>

      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>

      <Button type="submit" class="w-full" size="lg" :disabled="loading">
        {{ loading ? 'Creating account…' : 'Create account' }}
      </Button>
    </form>

    <div class="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span class="h-px flex-1 bg-border" />
      or continue with
      <span class="h-px flex-1 bg-border" />
    </div>

    <GoogleButton label="Sign up with Google" :loading="googleLoading" :disabled="loading" @click="google" />

    <p class="mt-6 text-center text-sm text-muted-foreground">
      Already have an account?
      <RouterLink :to="{ name: 'login' }" class="font-medium text-primary hover:underline">Sign in</RouterLink>
    </p>
  </AuthShell>
</template>
