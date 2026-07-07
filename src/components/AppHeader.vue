<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { MessageSquareText, Wallet, Plus, LogOut, ChevronDown } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Badge from '@/components/ui/Badge.vue'
import { useWallet } from '@/stores/wallet'
import { useAuth } from '@/stores/auth'

const router = useRouter()
const wallet = useWallet()
const { user, logout } = useAuth()

const menuOpen = ref(false)

const nav = [
  { name: 'compose', label: 'Compose' },
  { name: 'campaigns', label: 'Campaigns' },
  { name: 'senderIds', label: 'Sender IDs' },
  { name: 'reports', label: 'Reports' },
]

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function signOut() {
  menuOpen.value = false
  logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
      <div class="flex items-center gap-2">
        <RouterLink :to="{ name: 'compose' }" class="flex items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageSquareText class="size-5" />
          </div>
          <span class="text-lg font-semibold tracking-tight">Sendr <span class="font-normal text-muted-foreground">Bulk SMS</span></span>
        </RouterLink>
        <nav class="ml-6 hidden items-center gap-1 text-sm sm:flex">
          <RouterLink
            v-for="item in nav"
            :key="item.name"
            :to="{ name: item.name }"
            class="rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
            active-class="!text-foreground"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <RouterLink :to="{ name: 'topup' }">
          <Badge variant="secondary" class="gap-1.5 px-3 py-1.5 transition-colors hover:bg-secondary/70">
            <Wallet class="size-3.5" />
            <span class="font-semibold">{{ wallet.balance.value.toFixed(2) }}</span>
            <span class="text-muted-foreground">credits</span>
          </Badge>
        </RouterLink>
        <RouterLink :to="{ name: 'topup' }" class="hidden sm:block">
          <Button size="sm" variant="outline"><Plus class="size-4" /> Top up</Button>
        </RouterLink>

        <!-- User menu -->
        <div class="relative">
          <button
            class="flex items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="menuOpen = !menuOpen"
            @blur="menuOpen = false"
          >
            <span class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {{ user ? initials(user.name) : '?' }}
            </span>
            <ChevronDown class="size-4 text-muted-foreground" />
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 mt-2 w-52 overflow-hidden rounded-lg border bg-card shadow-lg"
            @mousedown.prevent
          >
            <div class="border-b px-3 py-2">
              <div class="truncate text-sm font-medium">{{ user?.name }}</div>
              <div class="truncate text-xs text-muted-foreground">{{ user?.email }}</div>
            </div>
            <button
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
              @click="signOut"
            >
              <LogOut class="size-4" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
