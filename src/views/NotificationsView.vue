<script setup lang="ts">
import { computed } from 'vue'
import { useNotificationStore } from '@/stores/notificationStore'
import { useLanguage } from '@/composables/useLanguage'
import Button from 'primevue/button'

const notificationStore = useNotificationStore()
const { t } = useLanguage()

const notifications = computed(() => notificationStore.notifications)
const hasNotifications = computed(() => notifications.value.length > 0)
const hasUnread = computed(() => notificationStore.unreadCount > 0)

const formatTime = (timestamp: number) => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', minutes)
  if (hours < 24) return t('time.hoursAgo', hours)
  return t('time.daysAgo', days)
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'download': return 'pi-download'
    case 'error': return 'pi-exclamation-circle'
    default: return 'pi-info-circle'
  }
}

const getTypeColor = (type: string) => {
  switch (type) {
    case 'download': return 'text-green-400'
    case 'error': return 'text-red-400'
    default: return 'text-blue-400'
  }
}

const handleNotificationClick = (id: string) => {
  notificationStore.markAsRead(id)
}

const handleDelete = (id: string, event: Event) => {
  event.stopPropagation()
  notificationStore.deleteNotification(id)
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-6 sm:mb-10">
      <div>
        <div class="flex items-center gap-3 sm:gap-4 mb-2 sm:mb-3">
          <div class="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <i class="pi pi-bell text-lg sm:text-2xl text-white"></i>
          </div>
          <h1 class="text-2xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {{ t('notifications.title') }}
          </h1>
        </div>
        <p class="text-gray-400 text-sm sm:text-lg ml-0 sm:ml-[4.5rem]">{{ t('notifications.subtitle') }}</p>
      </div>

      <!-- Actions -->
      <div v-if="hasNotifications" class="flex gap-2">
        <Button
          v-if="hasUnread"
          :label="t('notifications.markAllRead')"
          icon="pi pi-check-circle"
          severity="secondary"
          size="small"
          @click="notificationStore.markAllAsRead()"
        />
        <Button
          :label="t('notifications.clearAll')"
          icon="pi pi-trash"
          severity="danger"
          size="small"
          outlined
          @click="notificationStore.clearAll()"
        />
      </div>
    </div>

    <!-- Notifications List -->
    <div v-if="hasNotifications" class="space-y-3">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="relative bg-zinc-900/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 border transition-all duration-200 cursor-pointer group"
        :class="notification.read
          ? 'border-zinc-800/50 opacity-70'
          : 'border-zinc-700/50 hover:border-zinc-600'"
        @click="handleNotificationClick(notification.id)"
      >
        <!-- Unread indicator -->
        <div
          v-if="!notification.read"
          class="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-blue-500"
        ></div>

        <div class="flex gap-3 sm:gap-4">
          <!-- Icon -->
          <div
            class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
            :class="notification.type === 'download' ? 'bg-green-500/20' : notification.type === 'error' ? 'bg-red-500/20' : 'bg-blue-500/20'"
          >
            <i :class="['pi', getTypeIcon(notification.type), getTypeColor(notification.type), 'text-lg sm:text-xl']"></i>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0 pr-8">
            <h3 class="text-white font-semibold text-sm sm:text-base mb-1">{{ notification.title }}</h3>
            <p class="text-gray-400 text-xs sm:text-sm line-clamp-2">{{ notification.body }}</p>
            <p class="text-gray-500 text-xs mt-2">{{ formatTime(notification.timestamp) }}</p>
          </div>

          <!-- Delete button -->
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            class="!absolute top-4 right-10 !w-8 !h-8 !text-gray-400 sm:opacity-0 sm:group-hover:opacity-100 hover:!bg-zinc-700"
            @click="handleDelete(notification.id, $event)"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="bg-zinc-900/40 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-zinc-800/50 p-6 sm:p-12 text-center">
      <div class="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-zinc-800/80 flex items-center justify-center mb-4 sm:mb-8 mx-auto">
        <i class="pi pi-bell-slash text-3xl sm:text-5xl text-gray-500"></i>
      </div>
      <h3 class="text-lg sm:text-2xl font-bold text-white mb-2 sm:mb-3">{{ t('notifications.empty') }}</h3>
      <p class="text-gray-400 max-w-md mx-auto text-sm sm:text-lg">
        {{ t('notifications.emptyHint') }}
      </p>
    </div>
  </div>
</template>
