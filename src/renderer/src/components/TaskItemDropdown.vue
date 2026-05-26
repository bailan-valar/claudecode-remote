<script setup lang="ts">
import { Teleport, computed } from 'vue'
import type { Task } from '../../../shared/types'
import type { TaskStatus } from '../../../shared/constants'
import { TRANSITION_LABEL, STATUS_LABEL, STATUS_COLOR } from '../utils/taskTransitions'

interface Props {
  task: Task
  showDropdown: boolean
  showStatusSubmenu: boolean
  nextStates: TaskStatus[]
  dropdownStyle: { top: string; right: string }
  compact?: boolean
  showAppend?: boolean
  showSubtask?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  edit: [taskId: string]
  transition: [status: TaskStatus]
  addSubtask: [taskId: string]
  delete: [taskId: string]
  toggleSubmenu: [show: boolean]
  close: []
  append: []
  createSubtask: [taskId: string]
}>()

// 计算状态菜单的位置（在主菜单右侧）
const statusMenuStyle = computed(() => {
  const right = parseFloat(props.dropdownStyle.right)
  const top = parseFloat(props.dropdownStyle.top)

  return {
    top: `${top}px`,
    right: `${right + 180}px`, // 在主菜单右侧180px处
  }
})

function onEdit() {
  emit('edit', props.task._id)
  emit('close')
}

function onTransition(status: TaskStatus) {
  emit('transition', status)
  emit('close')
}

function onAddSubtask() {
  emit('addSubtask', props.task._id)
  emit('close')
}

function onDelete() {
  emit('delete', props.task._id)
  emit('close')
}

function onAppend() {
  emit('append')
  emit('close')
}

function onCreateSubtask() {
  emit('createSubtask', props.task._id)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <!-- 主下拉菜单 -->
    <div
      class="task-item-dropdown-menu"
      :class="{ compact }"
      :style="dropdownStyle"
      v-show="showDropdown"
      @click.stop
    >
      <button v-if="showAppend" class="dropdown-item" @click="onAppend">
        <span class="dropdown-icon">➕</span>
        追加任务
      </button>
      <div v-if="showAppend" class="dropdown-divider"></div>
      <button class="dropdown-item" @click="onEdit">
        <span class="dropdown-icon">✏️</span>
        编辑
      </button>
      <div class="dropdown-divider"></div>
      <button
        class="dropdown-item has-submenu"
        @mouseenter="emit('toggleSubmenu', true)"
        @mouseleave="emit('toggleSubmenu', false)"
      >
        <span class="dropdown-icon">🔀</span>
        修改状态
        <span class="submenu-arrow">▶</span>
      </button>
      <div class="dropdown-divider"></div>
      <button v-if="showSubtask" class="dropdown-item" @click="onCreateSubtask">
        <span class="dropdown-icon">📋</span>
        新增子任务
      </button>
      <button v-else class="dropdown-item" @click="onAddSubtask">
        <span class="dropdown-icon">➕</span>
        添加子任务
      </button>
      <div class="dropdown-divider"></div>
      <button class="dropdown-item danger" @click="onDelete">
        <span class="dropdown-icon">🗑️</span>
        删除
      </button>
    </div>

    <!-- 右侧独立状态菜单 -->
    <div
      v-show="showDropdown && showStatusSubmenu"
      class="status-side-menu"
      :class="{ compact }"
      :style="statusMenuStyle"
      @mouseenter="emit('toggleSubmenu', true)"
      @mouseleave="emit('toggleSubmenu', false)"
      @click.stop
    >
      <div class="status-menu-header">选择状态</div>
      <div class="status-menu-items">
        <button
          v-for="s in nextStates"
          :key="s"
          class="status-menu-item"
          @click.stop="onTransition(s)"
        >
          <span class="status-dot" :style="{ backgroundColor: STATUS_COLOR[s] }"></span>
          <span class="status-label">{{ TRANSITION_LABEL[s] || STATUS_LABEL[s] }}</span>
        </button>
        <div v-if="nextStates.length === 0" class="status-menu-item disabled">
          无可用状态
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.task-item-dropdown-menu {
  position: fixed;
  background: var(--glass-bg);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  min-width: 160px;
  z-index: 1000;
  overflow: hidden;
  animation: dropdownFadeIn 0.15s ease-out;
}

.task-item-dropdown-menu.compact {
  min-width: 140px;
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-divider {
  height: 1px;
  background: var(--glass-border-subtle);
  margin: 5px 10px;
}

.task-item-dropdown-menu.compact .dropdown-divider {
  margin: 3px 6px;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  background: transparent;
  border: none;
  text-align: left;
  font-size: 0.9375rem;
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--transition-fast);
  white-space: nowrap;
}

.task-item-dropdown-menu.compact .dropdown-item {
  gap: 6px;
  padding: 7px 10px;
  font-size: 0.875rem;
}

.dropdown-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.dropdown-item.danger {
  color: var(--color-error);
}

.dropdown-item.danger:hover {
  background: rgba(255, 59, 48, 0.1);
}

.dropdown-item.has-submenu {
  justify-content: flex-start;
}

.submenu-arrow {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

/* 右侧独立状态菜单 */
.status-side-menu {
  position: fixed;
  background: var(--glass-bg);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  min-width: 160px;
  z-index: 1000;
  overflow: hidden;
  animation: menuSlideIn 0.2s ease-out;
}

.status-side-menu.compact {
  min-width: 140px;
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

@keyframes menuSlideIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.status-menu-header {
  padding: 8px 14px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid var(--glass-border-subtle);
}

.status-side-menu.compact .status-menu-header {
  padding: 6px 10px;
  font-size: 0.6875rem;
}

.status-menu-items {
  padding: 4px 0;
}

.status-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  background: transparent;
  border: none;
  text-align: left;
  font-size: 0.9375rem;
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--transition-fast);
  white-space: nowrap;
}

.status-side-menu.compact .status-menu-item {
  gap: 8px;
  padding: 7px 10px;
  font-size: 0.875rem;
}

.status-menu-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

.status-menu-item.disabled {
  color: var(--color-text-secondary);
  cursor: not-allowed;
  opacity: 0.6;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-label {
  flex: 1;
}

.dropdown-icon {
  font-size: 0.9375rem;
  line-height: 1;
}

.task-item-dropdown-menu.compact .dropdown-icon {
  font-size: 0.875rem;
}

@media (max-width: 640px) {
  .task-item-dropdown-menu {
    min-width: 150px;
  }

  .dropdown-item {
    padding: 10px 14px;
    font-size: 1rem;
  }

  .dropdown-icon {
    font-size: 1rem;
  }

  .status-side-menu {
    min-width: 150px;
  }

  .status-menu-item {
    padding: 10px 14px;
    font-size: 1rem;
  }

  .status-menu-header {
    padding: 6px 14px;
    font-size: 0.6875rem;
  }
}
</style>
