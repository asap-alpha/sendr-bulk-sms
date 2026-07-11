<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/AuthShell.vue'
import GoogleButton from '@/components/GoogleButton.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import PasswordInput from '@/components/ui/PasswordInput.vue'
import Label from '@/components/ui/Label.vue'
import { useAuth } from '@/stores/auth'
import { authErrorMessage } from '@/lib/firebase'

const route = useRoute()
const router = useRouter()
const { login, loginWithGoogle } = useAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const googleLoading = ref(false)
const error = ref('')

function goNext() {
  const redirect = route.query.redirect as string | undefined
  router.push(redirect || { name: 'compose' })
}

async function submit() {
  error.value = ''
  if (!email.value.trim() || !password.value) {
    error.value = 'Enter your email and password.'
    return
  }
  loading.value = true
  try {
    await login(email.value.trim(), password.value)
    goNext()
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function google() {
  error.value = ''
  googleLoading.value = true
  try {
    await loginWithGoogle()
    goNext()
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    googleLoading.value = false
  }
}
</script>

<template>
  <AuthShell>
    <h2 class="text-2xl font-semibold tracking-tight">Welcome back</h2>
    <p class="mt-1 text-sm text-muted-foreground">Sign in to send your campaigns.</p>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <div class="grid gap-1.5">
        <Label for="email">Email</Label>
        <Input id="email" v-model="email" type="email" placeholder="you@company.com" />
      </div>
      <div class="grid gap-1.5">
        <Label for="password">Password</Label>
        <PasswordInput id="password" v-model="password" placeholder="••••••••" />
      </div>

      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>

      <Button type="submit" class="w-full" size="lg" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </Button>
    </form>

    <div class="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span class="h-px flex-1 bg-border" />
      or continue with
      <span class="h-px flex-1 bg-border" />
    </div>

    <GoogleButton :loading="googleLoading" :disabled="loading" @click="google" />

    <p class="mt-6 text-center text-sm text-muted-foreground">
      New to Sendr?
      <RouterLink :to="{ name: 'signup' }" class="font-medium text-primary hover:underline">Create an account</RouterLink>
    </p>
  </AuthShell>
</template>
