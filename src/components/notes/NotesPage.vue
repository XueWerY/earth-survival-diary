<template>
  <div class="notes-page" :class="{ 'fs-edit': fullscreenEdit }">
    <aside class="np-nav" :class="{ 'drawer-open': navDrawerOpen }">
      <div class="np-sidebar-toolbar" role="toolbar" aria-label="笔记侧栏视图">
        <button type="button" title="文件列表" aria-label="文件列表" :aria-pressed="sidebarPanel === 'files'" :class="{ active: sidebarPanel === 'files' }" @click="showSidebarPanel('files')"><el-icon><Files /></el-icon></button>
        <button type="button" title="搜索" aria-label="搜索" :aria-pressed="sidebarPanel === 'search'" :class="{ active: sidebarPanel === 'search' }" @click="showSidebarPanel('search')"><el-icon><Search /></el-icon></button>
        <button type="button" title="标签" aria-label="标签" :aria-pressed="sidebarPanel === 'tags'" :class="{ active: sidebarPanel === 'tags' }" @click="showSidebarPanel('tags')"><el-icon><Tags /></el-icon></button>
        <button type="button" title="回收站" aria-label="回收站" :aria-pressed="sidebarPanel === 'trash'" :class="{ active: sidebarPanel === 'trash' }" @click="showSidebarPanel('trash')"><el-icon><Trash2 /></el-icon></button>
      </div>
      <section v-if="sidebarPanel === 'files'" class="np-sidebar-panel">
        <div class="np-sidebar-header">
          <div class="np-sidebar-actions np-file-actions">
            <button type="button" title="新建笔记" aria-label="新建笔记" :disabled="!libraryWritable" @click="createNote"><el-icon><FilePlus /></el-icon></button>
            <button type="button" title="新建文件夹" aria-label="新建文件夹" :disabled="!libraryWritable" @click="openFolderDialog('create')"><el-icon><FolderPlus /></el-icon></button>
            <div class="np-sort-control" @click.stop>
              <button type="button" title="排序" aria-label="排序" :aria-expanded="sortMenuOpen" @click="sortMenuOpen = !sortMenuOpen"><el-icon><ArrowUpDown /></el-icon></button>
              <div v-if="sortMenuOpen" class="np-sort-menu" role="menu" aria-label="笔记排序方式">
                <button v-for="option in noteSortOptions" :key="option.value" type="button" role="menuitemradio"
                  :aria-checked="noteSort === option.value" :class="{ active: noteSort === option.value }"
                  @click="noteSort = option.value; sortMenuOpen = false">
                  <span>{{ option.label }}</span><el-icon v-if="noteSort === option.value"><Check /></el-icon>
                </button>
              </div>
            </div>
            <button type="button" :title="allFoldersExpanded ? '全部折叠' : '全部展开'" :aria-label="allFoldersExpanded ? '全部折叠' : '全部展开'" @click="toggleAllFolders"><el-icon><ListTree /></el-icon></button>
          </div>
        </div>
        <nav class="np-nav-scroll" aria-label="笔记文件树">
          <div class="np-tree-root" :class="{ active: currentView === folderViewId('') }">
            <button type="button" class="np-tree-row" @click="setView(folderViewId(''))">
              <el-icon><Folder /></el-icon><span class="np-tree-label">{{ activeLibraryName }}</span>
            </button>
          </div>
          <div
            v-for="row in visibleTreeRows"
            :key="row.key"
            class="np-tree-entry"
            :class="[
              row.type === 'folder' ? 'is-folder' : 'is-note',
              { active: row.type === 'folder' ? currentView === folderViewId(row.path) : selectedId === row.note?.id }
            ]"
            @contextmenu.prevent="row.type === 'note' && row.note ? askDeleteNote(row.note) : undefined"
          >
            <button type="button" class="np-tree-row" :style="{ paddingLeft: 8 + row.depth * 14 + 'px' }"
              :title="row.type === 'folder' ? row.path : (row.note?.title || '新笔记')" @click="selectTreeRow(row)">
              <span v-if="row.type === 'folder' && row.hasChildren" class="np-tree-chevron"
                :class="{ expanded: isFolderExpanded(row.path) }" @click.stop="toggleFolder(row.path)">
                <el-icon><ChevronRight /></el-icon>
              </span>
              <span v-else class="np-tree-chevron-spacer"></span>
              <el-icon class="np-tree-item-icon"><Folder v-if="row.type === 'folder'" /><FileText v-else /></el-icon>
              <span class="np-tree-label">{{ row.type === 'folder' ? row.name : (row.note?.title || '新笔记') }}</span>
              <span v-if="row.type === 'note' && row.note?.pinned" class="np-tree-pin" title="已置顶">•</span>
            </button>
            <span v-if="row.type === 'folder'" class="np-tree-actions">
              <button type="button" title="重命名文件夹" @click.stop="openFolderDialog('rename', row.path)"><el-icon><Pencil /></el-icon></button>
              <button type="button" title="删除空文件夹" @click.stop="askDeleteFolder(row.path)"><el-icon><Trash2 /></el-icon></button>
            </span>
            <span v-else-if="row.note" class="np-tree-actions">
              <button type="button" title="移入回收站" @click.stop="askDeleteNote(row.note)"><el-icon><Trash2 /></el-icon></button>
            </span>
          </div>
          <div v-if="libraryWritable && visibleTreeRows.length === 0" class="np-tree-empty">此文件夹还没有笔记或子文件夹</div>
        </nav>
      </section>

      <section v-else-if="sidebarPanel === 'search'" class="np-sidebar-panel np-search-panel">
        <div class="np-sidebar-header"><div class="np-sidebar-heading"><el-icon><Search /></el-icon><span>搜索</span></div></div>
        <div class="np-search">
          <el-icon><Search /></el-icon>
          <input ref="searchInputRef" v-model="query" placeholder="搜索笔记内容" aria-label="搜索笔记内容" />
          <button v-if="query" type="button" title="清除搜索" @click="query = ''"><el-icon><X /></el-icon></button>
        </div>
        <div class="np-search-results" aria-live="polite">
          <button v-for="note in searchResults" :key="note.id" type="button" class="np-search-result"
            :class="{ active: selectedId === note.id }" @click="openNote(note)">
            <el-icon><FileText /></el-icon><span><strong>{{ note.title || '新笔记' }}</strong><small>{{ note.folderPath || '笔记库根目录' }}</small></span>
          </button>
          <div v-if="query && searchResults.length === 0" class="np-tree-empty">没有匹配的笔记</div>
          <div v-else-if="!query" class="np-tree-empty">输入关键词搜索笔记标题、正文和标签</div>
        </div>
      </section>

      <section v-else-if="sidebarPanel === 'tags'" class="np-sidebar-panel np-tags-panel">
        <div class="np-sidebar-header">
          <div class="np-sidebar-heading"><el-icon><Tags /></el-icon><span>标签</span></div>
          <button type="button" class="np-sidebar-icon-button" title="新建标签" :disabled="!libraryWritable" @click="openCreateTag"><el-icon><Plus /></el-icon></button>
        </div>
        <div class="np-tag-tree"><TagTree :active="currentView" :folder-path="currentTagFolderPath" @select="setView" @edit="openEditTag" /></div>
        <div v-if="activeTagIds !== null" class="np-tag-note-list">
          <div class="np-tag-note-list-heading">匹配笔记 <span>{{ activeTagNotes.length }}</span></div>
          <button v-for="note in activeTagNotes" :key="note.id" type="button" class="np-search-result"
            :class="{ active: selectedId === note.id }" @click="openNote(note)">
            <el-icon><FileText /></el-icon><span><strong>{{ note.title || '新笔记' }}</strong><small>{{ note.folderPath || '笔记库根目录' }}</small></span>
          </button>
          <div v-if="activeTagNotes.length === 0" class="np-tree-empty">这个标签下还没有笔记</div>
        </div>
      </section>

      <section v-else class="np-sidebar-panel np-trash-sidebar">
        <div class="np-sidebar-header"><div class="np-sidebar-heading"><el-icon><Trash2 /></el-icon><span>回收站</span></div></div>
        <p>已删除 {{ noteStore.trashedNotes.length }} 篇笔记。恢复和彻底删除操作在右侧列表中进行。</p>
      </section>
      <footer class="np-library-footer">
        <div class="np-library-switcher" @click.stop>
          <button type="button" class="np-library-switcher-button" :title="activeLibraryName" aria-label="切换笔记库" aria-haspopup="listbox" :aria-expanded="libraryMenuOpen" @click="libraryMenuOpen = !libraryMenuOpen">
            <el-icon class="np-library-switcher-icon"><Library /></el-icon><span>{{ activeLibraryName }}</span><el-icon class="np-library-switcher-chevron"><ChevronDown /></el-icon>
          </button>
          <div v-if="libraryMenuOpen" class="np-library-menu" role="listbox" aria-label="已记录的笔记库">
            <div class="np-library-menu-heading">切换笔记库</div>
            <button v-for="library in libraryInfo?.libraries || []" :key="library.id" type="button" role="option"
              class="np-library-menu-item" :class="{ active: library.id === libraryInfo?.activeLibraryId }"
              :disabled="!library.rootExists" @click="selectLibraryFromMenu(library.id)">
              <el-icon><Folder /></el-icon><span><strong>{{ library.name }}</strong><small>{{ library.rootPath }}</small></span>
              <el-icon v-if="library.id === libraryInfo?.activeLibraryId" class="np-library-menu-check"><Check /></el-icon>
            </button>
            <div v-if="!libraryInfo?.libraries.length" class="np-library-menu-empty">还没有记录的笔记库</div>
            <div class="np-library-menu-divider"></div>
            <button type="button" class="np-library-menu-manage" @click="openLibraryManager"><el-icon><Settings /></el-icon><span>管理笔记库</span></button>
          </div>
        </div>
      </footer>
    </aside>
    <transition name="np-fade"><div v-if="navDrawerOpen" class="np-drawer-mask" @click="navDrawerOpen = false"></div></transition>

    <main class="np-workspace">
      <button type="button" class="np-mobile-nav-toggle" title="显示文件树" @click="navDrawerOpen = true"><el-icon><PanelLeft /></el-icon></button>
      <div v-if="!fullscreenEdit" class="np-tabbar" :class="{ stacked: tabsStacked }" role="toolbar" aria-label="笔记标签页">
        <div class="np-tab-strip" :class="{ stacked: tabsStacked }" role="tablist" aria-label="已打开的笔记">
          <button v-if="startTabOpen" type="button" class="np-tab" :class="{ active: activeTabKey === 'start' }"
            role="tab" :aria-selected="activeTabKey === 'start'" @click="openStartTab">
            <span class="np-tab-title">新标签页</span><span class="np-tab-close" title="关闭标签页" @click.stop="closeStartTab"><el-icon><X /></el-icon></span>
          </button>
          <button v-for="noteId in openTabIds" :key="noteId" type="button" class="np-tab"
            :class="{ active: activeTabKey === noteId }" role="tab" :aria-selected="activeTabKey === noteId"
            :title="noteTitleForTab(noteId)" @click="openNote(noteId)">
            <el-icon class="np-tab-file"><FileText /></el-icon><span class="np-tab-title">{{ noteTitleForTab(noteId) }}</span>
            <span class="np-tab-close" title="关闭标签页" @click.stop="closeNoteTab(noteId)"><el-icon><X /></el-icon></span>
          </button>
        </div>
        <div class="np-tab-controls">
          <button type="button" class="np-tab-control" title="新标签页" aria-label="新标签页" @click="openStartTab"><el-icon><Plus /></el-icon></button>
          <div class="np-tab-menu-wrap" @click.stop>
            <button type="button" class="np-tab-control" title="分屏布局" aria-label="分屏布局" :aria-expanded="splitMenuOpen" @click="splitMenuOpen = !splitMenuOpen"><el-icon><EllipsisVertical /></el-icon></button>
            <div v-if="splitMenuOpen" class="np-tab-menu np-split-menu" role="menu">
              <button type="button" role="menuitem" :class="{ active: splitDirection === 'vertical' }" @click="setSplitDirection('vertical')"><el-icon><Columns2 /></el-icon><span>左右分屏</span></button>
              <button type="button" role="menuitem" :class="{ active: splitDirection === 'horizontal' }" @click="setSplitDirection('horizontal')"><el-icon><Rows2 /></el-icon><span>上下分屏</span></button>
            </div>
          </div>
          <div class="np-tab-menu-wrap" @click.stop>
            <button type="button" class="np-tab-control" title="标签页菜单" aria-label="标签页菜单" :aria-expanded="tabMenuOpen" @click="tabMenuOpen = !tabMenuOpen"><el-icon><Layers /></el-icon></button>
            <div v-if="tabMenuOpen" class="np-tab-menu np-tabs-menu" role="menu">
              <button type="button" role="menuitem" :class="{ active: tabsStacked }" @click="tabsStacked = !tabsStacked; tabMenuOpen = false"><el-icon><Layers /></el-icon><span>堆叠标签页</span></button>
              <button type="button" role="menuitem" @click="closeAllTabs"><el-icon><X /></el-icon><span>全部关闭</span></button>
              <button type="button" role="menuitem" @click="openStartTab"><el-icon><FilePlus /></el-icon><span>新标签页</span></button>
            </div>
          </div>
        </div>
      </div>
      <div class="np-workspace-content" :class="{ 'is-split-vertical': splitDirection === 'vertical', 'is-split-horizontal': splitDirection === 'horizontal' }">
        <div class="np-workspace-primary">
      <section v-if="currentView === 'trash'" class="np-trash-view">
        <header class="np-trash-header"><div><h2>回收站</h2><p>{{ filteredTrashNotes.length }} 篇笔记</p></div>
          <button type="button" class="np-empty-trash" :disabled="!noteStore.trashedNotes.length" @click="askEmptyTrash">
            <el-icon><Trash2 /></el-icon><span>清空回收站</span>
          </button>
        </header>
        <div v-if="filteredTrashNotes.length" class="np-trash-list">
          <article v-for="note in filteredTrashNotes" :key="note.id" class="np-trash-item">
            <div class="np-trash-item-copy"><strong>{{ note.title || '新笔记' }}</strong><span>{{ note.folderPath || '未分类' }}</span></div>
            <div class="np-trash-item-actions">
              <button type="button" @click="restoreNoteFromTrash(note)"><el-icon><RotateCcw /></el-icon><span>恢复</span></button>
              <button type="button" class="danger" @click="askDeleteNote(note)"><el-icon><Trash2 /></el-icon><span>彻底删除</span></button>
            </div>
          </article>
        </div>
        <div v-else class="np-empty-state"><el-icon><Trash2 /></el-icon><strong>{{ query ? '没有匹配的笔记' : '回收站是空的' }}</strong>
          <span>{{ query ? '换个关键词试试' : '移入回收站的笔记会在这里保留 30 天。' }}</span>
        </div>
      </section>
      <section v-else-if="selectedNote" class="np-editor">
        <div class="np-editor-main">
          <div class="np-editor-head">
            <input ref="titleInputRef" v-model="titleDraft" class="np-title-input" :readonly="!libraryWritable"
              placeholder="无标题" @input="onTitleInput" />
            <div class="np-props" :class="{ 'is-readonly': !libraryWritable }">
              <label class="np-folder-select" title="笔记只能在同一最外层文件夹内移动">
                <el-icon><Folder /></el-icon>
                <select :value="selectedNote.folderPath || ''" :disabled="!libraryWritable" @change="moveSelectedNoteToFolder">
                  <option value="" :disabled="!!noteOuterFolderPath(selectedNote.folderPath)">未分类</option>
                  <option v-for="folder in selectedNoteFolderOptions" :key="folder" :value="folder">{{ folder }}</option>
                </select>
              </label>
              <div class="np-props-tags" @click.stop>
                <span v-for="tag in noteTags" :key="tag.id" class="np-tag-chip" :style="{ color: tag.color, borderColor: tag.color }">
                  {{ tag.name }}<button class="np-tag-x" title="移除标签" @click="detachTag(tag)"><el-icon><X /></el-icon></button>
                </span>
                <button class="np-tag-add" title="添加标签 (Ctrl+Shift+T)" @click="openTagPicker"><el-icon><Plus /></el-icon><span>标签</span></button>
                <div v-if="tagPickerOpen" class="np-tag-picker">
                  <input ref="tagInputRef" v-model="tagQuery" class="np-tag-input" placeholder="输入标签名，/ 建层级，回车确认" @keydown="onTagKeydown" />
                  <div class="np-tag-sugs">
                    <button v-for="(suggestion, index) in tagSuggestions" :key="suggestion.kind + ':' + suggestion.label"
                      class="np-tag-sug" :class="{ hl: index === sugIndex }" @mousedown.prevent="applySuggestion(suggestion)" @mouseenter="sugIndex = index">
                      <span class="np-tag-sug-dot" :style="{ background: suggestion.kind === 'existing' ? suggestion.tag.color : 'rgba(255,255,255,0.28)' }"></span>
                      <span class="np-tag-sug-label">{{ suggestion.label }}</span>
                      <span class="np-tag-sug-sub">{{ suggestion.kind === 'existing' ? suggestion.count + ' 篇' : '新建' }}</span>
                    </button>
                    <div v-if="tagSuggestions.length === 0" class="np-tag-sug-empty">输入名称后回车创建</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="np-editor-body">
            <div v-if="!libraryWritable" class="np-library-readonly-mask">
              <div class="np-library-readonly-card"><el-icon><Folder /></el-icon><strong>笔记库不可用</strong>
                <span>切换或重新选择笔记库后即可继续编辑。</span><button type="button" @click="chooseNotesLibrary">切换笔记库</button>
              </div>
            </div>
            <NoteEditor ref="editorRef" :fullscreen-edit="fullscreenEdit" :note="selectedNote" :source-mode="editorSourceMode"
              :note-titles="linkableNoteTitles" @toggle-pin="selectedNote && togglePin(selectedNote)"
              @toggle-fullscreen-edit="fullscreenEdit = !fullscreenEdit" @toggle-source-mode="editorSourceMode = !editorSourceMode"
              @export="handleExportCommand" @open-wiki-link="openWikiLink" @save="handleEditorSave" />
          </div>
        </div>
      </section>

      <section v-else-if="activeTagIds !== null" class="np-tag-results-view">
        <header class="np-trash-header"><div><h2>标签笔记</h2><p>{{ activeTagNotes.length }} 篇笔记</p></div></header>
        <div class="np-tag-results-list">
          <button v-for="note in activeTagNotes" :key="note.id" type="button" class="np-tag-result-card" @click="openNote(note)">
            <strong>{{ note.title || '新笔记' }}</strong><span>{{ note.folderPath || '笔记库根目录' }}</span>
            <small>{{ getMdPlainText(note.content).slice(0, 140) || '暂无正文' }}</small>
          </button>
          <div v-if="activeTagNotes.length === 0" class="np-empty-state"><el-icon><Tags /></el-icon><strong>这个标签下还没有笔记</strong></div>
        </div>
      </section>
      <section v-else class="np-empty-state np-welcome">
        <el-icon><FileText /></el-icon>
        <strong>{{ !libraryWritable ? '先选择笔记库' : sidebarPanel === 'search' ? (query ? (searchResults.length ? '从搜索结果中选择一篇笔记' : '没有匹配的笔记') : '搜索笔记') : sidebarPanel === 'tags' ? '选择一个标签查看相关笔记' : '选择或新建一篇笔记' }}</strong>
        <span>{{ !libraryWritable ? '笔记会按照目录保存在你选择的笔记库中。' : sidebarPanel === 'search' ? (query ? '搜索结果显示在左侧面板。' : '在左侧输入关键词，搜索标题、正文和标签。') : sidebarPanel === 'tags' ? '选择标签后，可查看该标签及其子标签下的笔记。' : '从左侧文件树打开笔记，或创建新笔记。' }}</span>
        <button v-if="libraryWritable" type="button" @click="createNote"><el-icon><Plus /></el-icon>新建笔记</button>
        <button v-else type="button" @click="chooseNotesLibrary"><el-icon><Folder /></el-icon>选择笔记库</button>
      </section>
        </div>
        <aside v-if="splitDirection" class="np-secondary-pane">
          <header class="np-secondary-header">
            <select :value="secondaryNoteId || ''" aria-label="分屏笔记" @change="onSecondaryNoteChange">
              <option value="">选择笔记</option>
              <option v-for="note in secondaryNoteOptions" :key="note.id" :value="note.id">{{ note.title || '新笔记' }}</option>
            </select>
            <button type="button" title="关闭分屏" aria-label="关闭分屏" @click="splitDirection = null"><el-icon><X /></el-icon></button>
          </header>
          <div v-if="secondaryNote" ref="secondaryPaneRoot" class="np-secondary-editor">
            <h2>{{ secondaryNote.title || '新笔记' }}</h2>
            <NoteEditor ref="secondaryEditorRef" :note="secondaryNote" :source-mode="secondarySourceMode"
              :note-titles="secondaryLinkableTitles" @save="handleEditorSave" @toggle-pin="togglePin(secondaryNote)"
              @toggle-fullscreen-edit="enterSecondaryFullscreen" @toggle-source-mode="secondarySourceMode = !secondarySourceMode"
              @open-wiki-link="openWikiLink" @export="handleSecondaryExport" />
          </div>
          <div v-else class="np-secondary-empty"><el-icon><FileText /></el-icon><span>选择一篇笔记在此处打开</span></div>
        </aside>
      </div>
    </main>

    <div v-if="libraryManagerVisible" class="np-library-manager-mask" @click.self="libraryManagerVisible = false">
      <section class="np-library-manager" role="dialog" aria-modal="true" aria-label="管理笔记库">
        <aside class="np-library-manager-list">
          <button v-for="library in libraryInfo?.libraries || []" :key="library.id" type="button" class="np-library-manager-entry"
            :class="{ active: library.id === libraryInfo?.activeLibraryId }" :disabled="!library.rootExists"
            @click="selectLibraryFromMenu(library.id, true)">
            <span><strong>{{ library.name }}</strong><small :title="library.rootPath">{{ library.rootPath }}</small></span>
            <span class="np-library-manager-entry-status">{{ library.rootExists ? (library.id === libraryInfo?.activeLibraryId ? '当前' : '') : '不可用' }}</span>
          </button>
          <div v-if="!libraryInfo?.libraries.length" class="np-library-manager-empty">还没有添加笔记库</div>
        </aside>
        <main class="np-library-manager-main">
          <button type="button" class="np-library-manager-close" title="关闭" @click="libraryManagerVisible = false"><el-icon><X /></el-icon></button>
          <div class="np-library-manager-content">
            <div class="np-library-manager-options">
              <section><div><strong>新建笔记库</strong><p>在指定文件夹中创建一个新的笔记库。</p></div><button type="button" class="primary" @click="chooseNotesLibrary">创建</button></section>
              <section><div><strong>打开本地笔记库</strong><p>将一个本地文件夹作为笔记库并在应用中打开。</p></div><button type="button" @click="chooseNotesLibrary">打开</button></section>
            </div>
          </div>
        </main>
      </section>
    </div>

    <ConfirmDialog v-model="showDeleteConfirm" title="删除笔记"
      :message="deletingFromTrash ? '彻底删除「' + deletingTitle + '」？该操作不可恢复。' : '确定删除「' + deletingTitle + '」吗？将移入回收站，保留 30 天。'"
      @confirm="onDeleteConfirmed" />
    <ConfirmDialog v-model="showEmptyTrashConfirm" title="清空回收站"
      :message="'确定清空回收站吗？' + noteStore.trashedNotes.length + ' 篇笔记将被彻底删除，不可恢复。'"
      @confirm="onEmptyTrashConfirmed" />
    <TagForm :visible="tagFormVisible" :tag="editingTag" @update:visible="tagFormVisible = $event"
      @submit="handleTagFormSubmit" @delete="handleTagDelete" />
    <ConfirmDialog v-model="showTagDeleteConfirm" title="删除标签"
      :message="'确定删除标签「' + deletingTagName + '」吗？笔记会保留，仅移除该标签。'"
      @confirm="onTagDeleteConfirmed" />
    <div v-if="folderDialogVisible" class="np-folder-dialog-mask" @click.self="folderDialogVisible = false">
      <form class="np-folder-dialog" @submit.prevent="saveFolderDialog">
        <h3>{{ folderDialogMode === 'create' ? '新建文件夹' : '重命名文件夹' }}</h3>
        <label for="np-folder-name">文件夹路径</label>
        <input id="np-folder-name" v-model="folderDraft" maxlength="1024" placeholder="例如：项目/研究" autofocus />
        <p>使用 / 可一次创建多级文件夹。笔记不能跨最外层文件夹移动。</p>
        <div class="np-folder-dialog-actions"><button type="button" @click="folderDialogVisible = false">取消</button>
          <button type="submit" :disabled="!folderDraft.trim()">保存</button></div>
      </form>
    </div>
    <ConfirmDialog v-model="folderDeleteVisible" title="删除文件夹"
      :message="'确定删除空文件夹「' + folderToDelete + '」吗？文件夹中有笔记或子文件夹时无法删除。'"
      @confirm="deleteFolderConfirmed" />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowUpDown, Check, ChevronDown, ChevronRight, Columns2, EllipsisVertical, FilePlus, FileText, Files, Folder, FolderPlus, Layers, Library, ListTree, PanelLeft, Pencil, Plus, RotateCcw, Rows2, Search, Settings, Tags, Trash2, X } from '@lucide/vue'
import NoteEditor from './NoteEditor.vue'
import TagTree from './TagTree.vue'
import TagForm from './TagForm.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import { useNoteStore, getMdPlainText, type Note, type Tag } from '../../stores/noteStore'
import { createBigramIndex } from '../../utils/bigramSearch'
import { extractWikiLinks } from '../editor/wikiLink'
import { exportNoteMarkdown } from '../../utils/noteExport'
import { exportNoteHtml } from '../../utils/noteExportHtml'
import { comboFromEvent } from '../../stores/shortcutStore'
import { usePageNav, restoreModuleNavPath } from '../../composables/usePageNav'
import { logger } from '../../lib/logger'
import { clearCache } from '../../services/storageService'
import { resetMediaAssetMetadataCache } from '../../services/mediaAssets'
import {
  createNotesFolder, deleteNotesFolder, getNotesLibraryInfo, renameNotesFolder,
  selectNotesLibraryFolder, switchNotesLibrary, type NotesLibraryInfo
} from '../../services/notesLibrary'

const emit = defineEmits<{ (e: 'fullscreen-change', fullscreen: boolean): void }>()
const pageNav = usePageNav()
const noteStore = useNoteStore()
const libraryInfo = ref<NotesLibraryInfo | null>(null)
const libraryMenuOpen = ref(false)
const libraryManagerVisible = ref(false)
const libraryWritable = computed(() => !!libraryInfo.value?.configured && !!libraryInfo.value.rootExists)
const activeLibraryName = computed(() =>
  libraryInfo.value?.libraries.find(item => item.id === libraryInfo.value?.activeLibraryId)?.name || '笔记库'
)
const guideRunning = inject('guideRunning', ref(false))
const navPath = computed(() => pageNav.navPath.value)

const FOLDER_VIEW_PREFIX = 'folder:'
const TAG_PATH_VIEW_PREFIX = 'tagpath:'
const folderViewId = (folderPath: string) => FOLDER_VIEW_PREFIX + encodeURIComponent(folderPath)
const isFolderView = (view: string) => view.startsWith(FOLDER_VIEW_PREFIX)
const folderPathFromView = (view: string) => {
  if (!isFolderView(view)) return ''
  try { return decodeURIComponent(view.slice(FOLDER_VIEW_PREFIX.length)) } catch { return '' }
}
const tagPathViewId = (folderPath: string, tagPath: string) =>
  TAG_PATH_VIEW_PREFIX + encodeURIComponent(folderPath) + ':' + encodeURIComponent(tagPath)
const isTagPathView = (view: string) => view.startsWith(TAG_PATH_VIEW_PREFIX)
const tagPathPartsFromView = (view: string): { folderPath: string; tagPath: string } | null => {
  if (!isTagPathView(view)) return null
  const value = view.slice(TAG_PATH_VIEW_PREFIX.length)
  const separator = value.indexOf(':')
  if (separator < 0) return null
  try {
    return {
      folderPath: decodeURIComponent(value.slice(0, separator)),
      tagPath: decodeURIComponent(value.slice(separator + 1)),
    }
  } catch { return null }
}
const ROOT_VIEW = folderViewId('')
const currentView = computed(() => {
  const view = navPath.value[1] || ROOT_VIEW
  if (view === 'all' || view === 'favorites') return ROOT_VIEW
  if (view === 'trash' || isFolderView(view) || isTagPathView(view) || view.startsWith('v:')) return view
  if (noteStore.tags.some(tag => tag.id === view)) return view
  return ROOT_VIEW
})
const selectedNote = computed<Note | null>(() => {
  const id = navPath.value[2]
  return id ? noteStore.notes.find(note => note.id === id) || null : null
})
const selectedId = computed(() => selectedNote.value?.id || null)
const openTabIds = ref<string[]>([])
const startTabOpen = ref(true)
const startTabActive = ref(true)
const activeTabKey = computed(() => selectedId.value || (startTabActive.value ? 'start' : null))
const tabMenuOpen = ref(false)
const splitMenuOpen = ref(false)
const tabsStacked = ref(false)
const splitDirection = ref<'vertical' | 'horizontal' | null>(null)
const secondaryNoteId = ref<string | null>(null)
const secondarySourceMode = ref(false)
const secondaryNoteOptions = computed(() => noteStore.notes.filter(note => note.id !== selectedId.value))
const secondaryNote = computed(() => secondaryNoteId.value
  ? noteStore.notes.find(note => note.id === secondaryNoteId.value && note.id !== selectedId.value) || null
  : null)
const secondaryLinkableTitles = computed(() => noteStore.notes
  .filter(note => note.id !== secondaryNote.value?.id)
  .map(note => (note.title || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b)))
const noteTitleForTab = (id: string) => noteStore.notes.find(note => note.id === id)?.title?.trim() || '新笔记'
watch(selectedId, id => {
  if (!id) return
  if (!openTabIds.value.includes(id)) openTabIds.value.push(id)
  startTabActive.value = false
  if (secondaryNoteId.value === id) secondaryNoteId.value = secondaryNoteOptions.value[0]?.id || null
})
watch(() => noteStore.notes.map(note => note.id).join('|'), () => {
  const available = new Set(noteStore.notes.map(note => note.id))
  openTabIds.value = openTabIds.value.filter(id => available.has(id))
  if (secondaryNoteId.value && !available.has(secondaryNoteId.value)) secondaryNoteId.value = null
})
const openStartTab = () => {
  startTabOpen.value = true
  startTabActive.value = true
  tabMenuOpen.value = false
  splitMenuOpen.value = false
  sidebarPanel.value = 'files'
  pageNav.setNavPath(['notes', ROOT_VIEW])
}
const closeStartTab = () => {
  startTabOpen.value = false
  if (!startTabActive.value) return
  startTabActive.value = false
  const fallback = openTabIds.value.at(-1)
  if (fallback) openNote(fallback)
  else pageNav.setNavPath(['notes', ROOT_VIEW])
}
const closeNoteTab = (id: string) => {
  const index = openTabIds.value.indexOf(id)
  if (index < 0) return
  openTabIds.value.splice(index, 1)
  if (secondaryNoteId.value === id) secondaryNoteId.value = null
  if (selectedId.value !== id) return
  const fallback = openTabIds.value[index] || openTabIds.value[index - 1]
  if (fallback) openNote(fallback)
  else openStartTab()
}
const closeAllTabs = () => {
  openTabIds.value = []
  startTabOpen.value = false
  startTabActive.value = false
  splitDirection.value = null
  secondaryNoteId.value = null
  tabMenuOpen.value = false
  sidebarPanel.value = 'files'
  pageNav.setNavPath(['notes', ROOT_VIEW])
}
const setSplitDirection = (direction: 'vertical' | 'horizontal') => {
  splitDirection.value = direction
  splitMenuOpen.value = false
  const otherTab = openTabIds.value.find(id => id !== selectedId.value)
  secondaryNoteId.value = otherTab || secondaryNoteOptions.value[0]?.id || null
}
const setSecondaryNote = (id: string) => { secondaryNoteId.value = id || null }
const onSecondaryNoteChange = (event: Event) => setSecondaryNote((event.target as HTMLSelectElement).value)
const enterSecondaryFullscreen = () => {
  const note = secondaryNote.value
  if (!note) return
  splitDirection.value = null
  openNote(note)
  fullscreenEdit.value = true
}
const fullscreenEdit = ref(false)
watch(fullscreenEdit, value => emit('fullscreen-change', value))
const navDrawerOpen = ref(false)
type SidebarPanel = 'files' | 'search' | 'tags' | 'trash'
const sidebarPanel = ref<SidebarPanel>('files')
const query = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
type NoteSort = 'name-asc' | 'name-desc' | 'edited-desc' | 'edited-asc' | 'created-desc' | 'created-asc'
const noteSort = ref<NoteSort>('name-asc')
const sortMenuOpen = ref(false)
const noteSortOptions: Array<{ value: NoteSort; label: string }> = [
  { value: 'name-asc', label: '文件名 (A-Z)' },
  { value: 'name-desc', label: '文件名 (Z-A)' },
  { value: 'edited-desc', label: '编辑时间（从新到旧）' },
  { value: 'edited-asc', label: '编辑时间（从旧到新）' },
  { value: 'created-desc', label: '创建时间（从新到旧）' },
  { value: 'created-asc', label: '创建时间（从旧到新）' },
]
const expandedFolders = ref<Set<string>>(new Set())
const noteOuterFolderPath = (path: string) => String(path || '').replace(/\\/g, '/').split('/')[0] || ''
const folderRows = computed(() => [...(libraryInfo.value?.folders || [])]
  .map(path => ({ path, name: path.split('/').at(-1) || path }))
  .sort((a, b) => a.path.localeCompare(b.path, 'zh')))
watch(() => libraryInfo.value?.activeLibraryId, () => {
  expandedFolders.value = new Set(libraryInfo.value?.folders || [])
}, { immediate: true })
watch(() => (libraryInfo.value?.folders || []).join('|'), () => {
  const next = new Set(expandedFolders.value)
  for (const folder of libraryInfo.value?.folders || []) next.add(folder)
  expandedFolders.value = next
})
const isFolderExpanded = (path: string) => expandedFolders.value.has(path)
const allFoldersExpanded = computed(() => folderRows.value.length > 0 && folderRows.value.every(({ path }) => expandedFolders.value.has(path)))
const toggleAllFolders = () => {
  expandedFolders.value = allFoldersExpanded.value ? new Set() : new Set(folderRows.value.map(({ path }) => path))
}
const toggleFolder = (path: string) => {
  const next = new Set(expandedFolders.value)
  next.has(path) ? next.delete(path) : next.add(path)
  expandedFolders.value = next
}

const tagScopeForView = (view: string): { folderPath: string; tagPath: string } | null => {
  const scoped = tagPathPartsFromView(view)
  if (scoped) return scoped
  if (view.startsWith('v:')) return { folderPath: '', tagPath: view.slice(2) }
  const tag = noteStore.tags.find(item => item.id === view)
  return tag ? { folderPath: tag.folderPath || '', tagPath: tag.name } : null
}
const currentTagFolderPath = computed(() => {
  const view = currentView.value
  if (isFolderView(view)) return folderPathFromView(view)
  const scoped = tagPathPartsFromView(view)
  if (scoped) return scoped.folderPath
  if (view.startsWith('v:')) return ''
  const tag = noteStore.tags.find(item => item.id === view)
  return tag ? tag.folderPath || '' : selectedNote.value?.folderPath || ''
})
const noteContextForView = (view: string): { folderPath: string; tagIds: string[] } => {
  if (isFolderView(view)) return { folderPath: folderPathFromView(view), tagIds: [] }
  const tag = noteStore.tags.find(item => item.id === view)
  if (tag) return { folderPath: tag.folderPath || '', tagIds: [tag.id] }
  const scope = tagScopeForView(view)
  return scope ? { folderPath: scope.folderPath, tagIds: [] } : { folderPath: '', tagIds: [] }
}
const activeTagIds = computed<string[] | null>(() => {
  const scope = tagScopeForView(currentView.value)
  if (!scope) return null
  return noteStore.tags
    .filter(tag => tag.folderPath === scope.folderPath
      && (tag.name === scope.tagPath || tag.name.startsWith(scope.tagPath + '/')))
    .map(tag => tag.id)
})
const searchIndex = createBigramIndex()
const searchableText = (note: Note) => {
  const tags = note.tagIds.map(id => noteStore.tags.find(tag => tag.id === id)?.name).filter(Boolean).join(' ')
  return note.title + '\n' + getMdPlainText(note.content) + '\n' + tags
}
const searchVersion = computed(() =>
  noteStore.notes.map(note => note.id + ':' + note.updatedAt).join('|')
  + '|' + noteStore.trashedNotes.map(note => note.id + ':' + note.updatedAt).join('|')
  + '|' + noteStore.tags.map(tag => tag.id + ':' + tag.name + ':' + tag.folderPath).join('|')
)
watch(searchVersion, () => {
  searchIndex.reset()
  for (const note of noteStore.notes) searchIndex.setDoc(note.id, searchableText(note))
  for (const note of noteStore.trashedNotes) searchIndex.setDoc(note.id, searchableText(note))
}, { immediate: true })
const searchResults = computed(() => {
  const search = query.value.trim()
  if (!search) return []
  void searchVersion.value
  const hits = new Set(searchIndex.search(search))
  return noteStore.notes.filter(note => hits.has(note.id))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh'))
})
const activeTagNotes = computed(() => {
  const tagIds = activeTagIds.value
  if (tagIds === null) return []
  const ids = new Set(tagIds)
  return noteStore.notes.filter(note => note.tagIds.some(id => ids.has(id)))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh'))
})
const compareNotes = (a: Note, b: Note) => {
  const byName = a.title.localeCompare(b.title, 'zh', { numeric: true, sensitivity: 'base' })
  if (noteSort.value === 'name-desc') return -byName
  if (noteSort.value === 'edited-desc') return b.updatedAt.localeCompare(a.updatedAt) || byName
  if (noteSort.value === 'edited-asc') return a.updatedAt.localeCompare(b.updatedAt) || byName
  if (noteSort.value === 'created-desc') return b.createdAt.localeCompare(a.createdAt) || byName
  if (noteSort.value === 'created-asc') return a.createdAt.localeCompare(b.createdAt) || byName
  return byName
}
const compareFolders = (a: string, b: string) => {
  const left = a.split('/').at(-1) || a
  const right = b.split('/').at(-1) || b
  const byName = left.localeCompare(right, 'zh', { numeric: true, sensitivity: 'base' })
  return noteSort.value === 'name-desc' ? -byName : byName
}

type TreeRow = { key: string; type: 'folder' | 'note'; path: string; name: string; depth: number; hasChildren: boolean; note?: Note }
const visibleTreeRows = computed<TreeRow[]>(() => {
  if (currentView.value === 'trash') return []
  const notes = [...noteStore.notes]
  const notesByFolder = new Map<string, Note[]>()
  for (const note of notes) {
    const path = note.folderPath || ''
    const group = notesByFolder.get(path) || []
    group.push(note)
    notesByFolder.set(path, group)
  }
  for (const group of notesByFolder.values()) group.sort(compareNotes)
  const childrenByParent = new Map<string, string[]>()
  for (const { path } of folderRows.value) {
    const parts = path.split('/')
    const parent = parts.slice(0, -1).join('/')
    const children = childrenByParent.get(parent) || []
    children.push(path)
    childrenByParent.set(parent, children)
  }
  for (const children of childrenByParent.values()) children.sort(compareFolders)
  const rows: TreeRow[] = []
  const appendNotes = (path: string, depth: number) => {
    for (const note of notesByFolder.get(path) || []) rows.push({
      key: 'note:' + note.id, type: 'note', path, name: note.title || '新笔记', depth, hasChildren: false, note,
    })
  }
  const appendFolder = (path: string, depth: number) => {
    const children = childrenByParent.get(path) || []
    const directNotes = notesByFolder.get(path) || []
    rows.push({
      key: 'folder:' + path, type: 'folder', path, name: path.split('/').at(-1) || path,
      depth, hasChildren: children.length > 0 || directNotes.length > 0,
    })
    if (!isFolderExpanded(path)) return
    for (const child of children) appendFolder(child, depth + 1)
    appendNotes(path, depth + 1)
  }
  for (const path of childrenByParent.get('') || []) appendFolder(path, 0)
  appendNotes('', 0)
  return rows
})
const filteredTrashNotes = computed(() => {
  const search = query.value.trim()
  if (!search) return [...noteStore.trashedNotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  void searchVersion.value
  const hits = new Set(searchIndex.search(search))
  return noteStore.trashedNotes.filter(note => hits.has(note.id))
})
const setView = (view: string) => {
  navDrawerOpen.value = false
  const target = ['all', 'favorites'].includes(view) ? ROOT_VIEW : view
  if (target === 'trash') sidebarPanel.value = 'trash'
  else if (isTagPathView(target) || target.startsWith('v:') || noteStore.tags.some(tag => tag.id === target)) sidebarPanel.value = 'tags'
  else sidebarPanel.value = 'files'
  if (currentView.value === target && navPath.value.length <= 2) return
  pageNav.setNavPath(isFolderView(target) && selectedId.value
    ? ['notes', target, selectedId.value]
    : ['notes', target])
}
const showSidebarPanel = (panel: SidebarPanel) => {
  navDrawerOpen.value = false
  if (panel === 'trash') {
    query.value = ''
    setView('trash')
    return
  }
  if ((panel === 'files' || panel === 'search') && (currentView.value === 'trash' || activeTagIds.value !== null)) setView(ROOT_VIEW)
  if (panel !== 'trash' && currentView.value === 'trash') setView(ROOT_VIEW)
  sidebarPanel.value = panel
  if (panel === 'search') nextTick(() => searchInputRef.value?.focus())
}
const openNote = (input: Note | string) => {
  const note = typeof input === 'string' ? noteStore.notes.find(item => item.id === input) : input
  if (!note) return
  if (!openTabIds.value.includes(note.id)) openTabIds.value.push(note.id)
  startTabActive.value = false
  tabMenuOpen.value = false
  splitMenuOpen.value = false
  pageNav.setNavPath(['notes', folderViewId(note.folderPath || ''), note.id])
  navDrawerOpen.value = false
  const parts = (note.folderPath || '').split('/').filter(Boolean)
  for (let index = 1; index <= parts.length; index++) {
    const next = new Set(expandedFolders.value)
    next.add(parts.slice(0, index).join('/'))
    expandedFolders.value = next
  }
}
const selectTreeRow = (row: TreeRow) => row.type === 'folder' ? setView(folderViewId(row.path)) : row.note && openNote(row.note)
watch(navPath, () => {
  const path = pageNav.navPath.value
  if (path[0] !== 'notes') return
  if (path.length >= 3 && !noteStore.notes.some(note => note.id === path[2])) {
    const missingId = path[2]
    const oldIndex = openTabIds.value.indexOf(missingId)
    openTabIds.value = openTabIds.value.filter(id => id !== missingId)
    const fallback = openTabIds.value[oldIndex] || openTabIds.value[oldIndex - 1]
    if (fallback) openNote(fallback)
    else openStartTab()
    return
  }
  navDrawerOpen.value = false
})
watch(() => selectedNote.value?.folderPath, path => {
  if (!path) return
  const parts = path.split('/').filter(Boolean)
  const next = new Set(expandedFolders.value)
  for (let index = 1; index <= parts.length; index++) next.add(parts.slice(0, index).join('/'))
  expandedFolders.value = next
})
const editorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const secondaryEditorRef = ref<InstanceType<typeof NoteEditor> | null>(null)
const secondaryPaneRoot = ref<HTMLElement | null>(null)
const titleInputRef = ref<HTMLInputElement | null>(null)
const titleDraft = ref('')
const editorSourceMode = ref(false)
watch([selectedId, () => selectedNote.value?.title], ([id, title]) => { titleDraft.value = id ? title || '' : '' }, { immediate: true })
const onTitleInput = () => editorRef.value?.setNoteTitle(titleDraft.value)
const noteTags = computed<Tag[]>(() => {
  const note = selectedNote.value
  return note ? note.tagIds.map(id => noteStore.tags.find(tag => tag.id === id)).filter((tag): tag is Tag => !!tag) : []
})
const tagPickerOpen = ref(false)
const tagQuery = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)
const sugIndex = ref(0)
const openTagPicker = () => {
  tagPickerOpen.value = true
  tagQuery.value = ''
  sugIndex.value = 0
  nextTick(() => tagInputRef.value?.focus())
}
watch(selectedId, () => { tagPickerOpen.value = false; tagQuery.value = '' })
const attachTag = async (tag: Tag) => {
  const note = selectedNote.value
  if (!note) return
  if (!note.tagIds.includes(tag.id)) await noteStore.updateNote(note.id, { tagIds: [...note.tagIds, tag.id] })
  tagPickerOpen.value = false
  tagQuery.value = ''
}
const detachTag = async (tag: Tag) => {
  const note = selectedNote.value
  if (note) await noteStore.updateNote(note.id, { tagIds: note.tagIds.filter(id => id !== tag.id) })
}
type TagSuggestion = { kind: 'existing'; tag: Tag; label: string; count: number } | { kind: 'create'; label: string }
const tagSuggestions = computed<TagSuggestion[]>(() => {
  const q = tagQuery.value.trim().replace(/^#/, '').toLowerCase()
  const attached = new Set(selectedNote.value?.tagIds || [])
  const folderPath = selectedNote.value?.folderPath || currentTagFolderPath.value
  const matches = noteStore.tags
    .filter(tag => tag.folderPath === folderPath && !attached.has(tag.id) && (!q || tag.name.toLowerCase().includes(q)))
    .slice(0, 8)
    .map(tag => ({
      kind: 'existing' as const, tag, label: tag.name,
      count: noteStore.notes.filter(note => note.folderPath === folderPath && note.tagIds.includes(tag.id)).length,
    }))
  const exact = noteStore.tags.some(tag => tag.folderPath === folderPath && tag.name.toLowerCase() === q)
  return [...matches, ...(q && !exact ? [{ kind: 'create' as const, label: q }] : [])]
})
watch(tagQuery, () => { sugIndex.value = 0 })
const applySuggestion = async (suggestion: TagSuggestion) => {
  if (suggestion.kind === 'existing') return attachTag(suggestion.tag)
  const tag = await noteStore.addTag({ name: suggestion.label, folderPath: selectedNote.value?.folderPath || currentTagFolderPath.value })
  if (tag) await attachTag(tag)
  else ElMessage.error('创建标签失败')
}
const onTagKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    sugIndex.value = Math.min(sugIndex.value + 1, tagSuggestions.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    sugIndex.value = Math.max(sugIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const suggestion = tagSuggestions.value[sugIndex.value]
    if (suggestion) void applySuggestion(suggestion)
  }
}
const tagFormVisible = ref(false)
const editingTag = ref<Tag | null>(null)
const openCreateTag = () => { editingTag.value = null; tagFormVisible.value = true }
const openEditTag = (tag: Tag) => { editingTag.value = tag; tagFormVisible.value = true }
const handleTagFormSubmit = async (data: { id?: string; name: string; color: string }) => {
  if (data.id) {
    if (!await noteStore.updateTag(data.id, { name: data.name, color: data.color })) {
      ElMessage.error('保存失败：标签名称与其他标签冲突')
      return
    }
    ElMessage.success('标签已保存')
  } else {
    const tag = await noteStore.addTag({ name: data.name, color: data.color, folderPath: currentTagFolderPath.value })
    if (!tag) { ElMessage.error('创建标签失败'); return }
    ElMessage.success('标签已创建')
  }
  tagFormVisible.value = false
}
const showTagDeleteConfirm = ref(false)
const deletingTag = ref<Tag | null>(null)
const deletingTagName = computed(() => deletingTag.value?.name || '')
const handleTagDelete = (tag: Tag) => { deletingTag.value = tag; showTagDeleteConfirm.value = true }
const onTagDeleteConfirmed = async () => {
  const tag = deletingTag.value
  if (tag && await noteStore.deleteTag(tag.id)) {
    ElMessage.success('标签已删除')
    if (currentView.value === tag.id || currentView.value === tagPathViewId(tag.folderPath || '', tag.name)) setView(ROOT_VIEW)
  }
  showTagDeleteConfirm.value = false
  tagFormVisible.value = false
  deletingTag.value = null
}

const linkIndex = computed(() => {
  const byTitle = new Map<string, Note>()
  for (const note of [...noteStore.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const key = note.title.trim().toLowerCase()
    if (key && !byTitle.has(key)) byTitle.set(key, note)
  }
  const resolve = (target: string) => byTitle.get(target.trim().toLowerCase()) || null
  const backlinks = new Map<string, Note[]>()
  for (const note of noteStore.notes) {
    for (const reference of extractWikiLinks(note.content)) {
      const linked = resolve(reference.target)
      if (!linked || linked.id === note.id) continue
      const list = backlinks.get(linked.id) || []
      if (!list.some(item => item.id === note.id)) list.push(note)
      backlinks.set(linked.id, list)
    }
  }
  return { resolve, backlinks }
})
const linkableNoteTitles = computed(() => noteStore.notes
  .filter(note => note.id !== selectedNote.value?.id)
  .map(note => (note.title || '').trim())
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b)))
const openWikiLink = async ({ target }: { target: string }) => {
  const linked = linkIndex.value.resolve(target)
  if (linked) { openNote(linked); return }
  const context = noteContextForView(currentView.value)
  const created = await noteStore.addNote({ title: target, content: '', tagIds: context.tagIds, folderPath: context.folderPath })
  if (created) { ElMessage.success('已创建「' + target + '」'); openNote(created) }
}

const handleExportCommand = async (command: string | number | object) => {
  const note = selectedNote.value
  if (!note) return
  if (command === 'md') {
    exportNoteMarkdown(note, noteTags.value)
    ElMessage.success('Markdown 已导出')
  } else if (command === 'html') await exportSelectedNoteHtml(note)
}
const exportSelectedNoteHtml = async (
  note: Note,
  editor: InstanceType<typeof NoteEditor> | null = editorRef.value,
  root: ParentNode = document,
  tags = note.tagIds.map(id => noteStore.tags.find(tag => tag.id === id)).filter((tag): tag is Tag => !!tag),
) => {
  try {
    if (editor && editor === secondaryEditorRef.value && secondarySourceMode.value) { secondarySourceMode.value = false; await nextTick() }
    else if (editor && editor === editorRef.value && editorSourceMode.value) { editorSourceMode.value = false; await nextTick() }
    const contentEl = await waitForProseMirror(root)
    if (!contentEl) { ElMessage.error('编辑器尚未就绪，请稍后再试'); return }
    const markdown = editor?.getMarkdownForExport() || note.content
    const linkedNotes: Array<{ note: Note; tags: Tag[]; contentEl: HTMLElement; markdown: string }> = []
    const wikiTargets: Record<string, string> = {}
    const visited = new Set([note.id])
    const pending = [note]
    for (let index = 0; index < pending.length; index++) {
      const current = pending[index]
      const source = current.id === note.id ? markdown : current.content
      for (const reference of extractWikiLinks(source)) {
        const linked = linkIndex.value.resolve(reference.target)
        if (!linked) continue
        wikiTargets[reference.target.trim().toLowerCase()] = linked.id
        if (!visited.has(linked.id)) { visited.add(linked.id); pending.push(linked) }
      }
    }
    for (const linked of pending.slice(1)) {
      const rendered = editor?.renderMarkdownForExport(linked.content)
      if (!rendered) throw new Error('无法渲染关联笔记「' + linked.title + '」')
      const linkedTags = linked.tagIds.map(id => noteStore.tags.find(tag => tag.id === id)).filter((tag): tag is Tag => !!tag)
      linkedNotes.push({ note: linked, tags: linkedTags, contentEl: rendered, markdown: linked.content })
    }
    await exportNoteHtml({ note, tags, contentEl, markdown, linkedNotes, wikiTargets })
    ElMessage.success('HTML 已导出（自包含，可离线打开）')
  } catch (error) {
    logger.error('[笔记] 导出 HTML 失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error('HTML 导出失败')
  }
}
const waitForProseMirror = async (root: ParentNode = document): Promise<HTMLElement | null> => {
  for (let index = 0; index < 30; index++) {
    const element = root.querySelector<HTMLElement>('.md-editor .ProseMirror')
    if (element && element.innerHTML.trim()) return element
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return null
}
const handleEditorSave = async (data: { id: string; title: string; content: string; pinned: boolean }) => {
  if (!await noteStore.updateNote(data.id, { title: data.title, content: data.content, pinned: data.pinned })) {
    logger.error('[笔记] 自动保存失败', { id: data.id })
  }
}
const handleSecondaryExport = async (command: string | number | object) => {
  const note = secondaryNote.value
  if (!note) return
  const tags = note.tagIds.map(id => noteStore.tags.find(tag => tag.id === id)).filter((tag): tag is Tag => !!tag)
  if (command === 'md') {
    exportNoteMarkdown(note, tags)
    ElMessage.success('Markdown 已导出')
  } else if (command === 'html') {
    await exportSelectedNoteHtml(note, secondaryEditorRef.value, secondaryPaneRoot.value || document, tags)
  }
}

const saveOpenNoteBeforeLibraryChange = async (): Promise<boolean> => {
  if (!libraryWritable.value) return true
  const notesToSave = [selectedNote.value, secondaryNote.value].filter((note): note is Note => !!note)
  for (const note of notesToSave) {
    const isSecondary = note.id === secondaryNote.value?.id
    const content = isSecondary
      ? secondaryEditorRef.value?.getMarkdownForExport() ?? note.content
      : editorRef.value?.getMarkdownForExport() ?? note.content
    const title = isSecondary ? note.title : titleDraft.value
    if (content === note.content && title === note.title) continue
    const saved = await noteStore.updateNote(note.id, { title, content, pinned: note.pinned })
    if (!saved) {
      ElMessage.error('当前笔记未能保存，笔记库没有切换')
      return false
    }
  }
  return true
}
const applyNotesLibraryChange = async (result: NotesLibraryInfo) => {
  clearCache()
  resetMediaAssetMetadataCache()
  libraryInfo.value = result
  sidebarPanel.value = 'files'
  openTabIds.value = []
  startTabOpen.value = true
  startTabActive.value = true
  splitDirection.value = null
  secondaryNoteId.value = null
  pageNav.setNavPath(['notes', ROOT_VIEW])
  await noteStore.syncFromRemote()
}
const openLibraryManager = () => {
  libraryMenuOpen.value = false
  libraryManagerVisible.value = true
}
const chooseNotesLibrary = async () => {
  try {
    if (!await saveOpenNoteBeforeLibraryChange()) return
    const previous = libraryInfo.value
    const result = await selectNotesLibraryFolder()
    if (!result) return
    if (result.activeLibraryId === previous?.activeLibraryId) {
      libraryInfo.value = result
      libraryManagerVisible.value = false
      ElMessage.info('当前笔记库未更改')
      return
    }
    await applyNotesLibraryChange(result)
    libraryManagerVisible.value = false
    libraryMenuOpen.value = false
    const wasKnown = previous?.libraries.some(item => item.id === result.activeLibraryId)
    if (!previous?.configured) ElMessage.success(result.legacyNoteCount ? '笔记库已设置，旧笔记已迁入' : '笔记库已设置')
    else ElMessage.success(wasKnown ? '已切换到笔记库「' + activeLibraryName.value + '」' : '已添加并切换到新笔记库')
  } catch (error) {
    logger.error('[笔记库] 添加或切换失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error(error instanceof Error ? error.message : '添加或切换笔记库失败')
  }
}
const selectLibraryFromMenu = async (id: string, closeManager = false) => {
  if (!id) return
  if (id === libraryInfo.value?.activeLibraryId) {
    libraryMenuOpen.value = false
    if (closeManager) libraryManagerVisible.value = false
    return
  }
  try {
    if (!await saveOpenNoteBeforeLibraryChange()) return
    await applyNotesLibraryChange(await switchNotesLibrary(id))
    libraryMenuOpen.value = false
    if (closeManager) libraryManagerVisible.value = false
    ElMessage.success('已切换到笔记库「' + activeLibraryName.value + '」')
  } catch (error) {
    logger.error('[笔记库] 切换失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error(error instanceof Error ? error.message : '切换笔记库失败')
  }
}
const folderDialogVisible = ref(false)
const folderDialogMode = ref<'create' | 'rename'>('create')
const folderDialogOriginalPath = ref('')
const folderDraft = ref('')
const openFolderDialog = (mode: 'create' | 'rename', folderPath = '') => {
  if (!libraryWritable.value) { ElMessage.info('请先选择笔记库文件夹'); return }
  folderDialogMode.value = mode
  folderDialogOriginalPath.value = folderPath
  folderDraft.value = mode === 'rename' ? folderPath : ''
  folderDialogVisible.value = true
}
const saveFolderDialog = async () => {
  const nextPath = folderDraft.value.trim()
  if (!nextPath) return
  const oldPath = folderDialogOriginalPath.value
  const selected = selectedNote.value
  const selectedPath = selected?.folderPath || ''
  try {
    if (folderDialogMode.value === 'create') {
      libraryInfo.value = await createNotesFolder(nextPath)
      ElMessage.success('文件夹已创建')
    } else {
      const scope = tagScopeForView(currentView.value)
      libraryInfo.value = await renameNotesFolder(oldPath, nextPath)
      clearCache()
      await noteStore.syncFromRemote()
      const remap = (path: string) => path === oldPath || path.startsWith(oldPath + '/')
        ? nextPath + path.slice(oldPath.length) : path
      if (isFolderView(currentView.value)) {
        const folder = folderPathFromView(currentView.value)
        if (folder === oldPath || folder.startsWith(oldPath + '/')) setView(folderViewId(remap(folder)))
      } else if (isTagPathView(currentView.value) && scope
        && (scope.folderPath === oldPath || scope.folderPath.startsWith(oldPath + '/'))) {
        setView(tagPathViewId(remap(scope.folderPath), scope.tagPath))
      }
      if (selected && (selectedPath === oldPath || selectedPath.startsWith(oldPath + '/'))) {
        pageNav.setNavPath(['notes', folderViewId(remap(selectedPath)), selected.id])
      }
      ElMessage.success('文件夹已重命名')
    }
    folderDialogVisible.value = false
  } catch (error) {
    logger.error('[笔记库] 保存文件夹失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error(error instanceof Error ? error.message : '保存文件夹失败')
  }
}
const folderDeleteVisible = ref(false)
const folderToDelete = ref('')
const askDeleteFolder = (path: string) => { folderToDelete.value = path; folderDeleteVisible.value = true }
const deleteFolderConfirmed = async () => {
  const path = folderToDelete.value
  const scope = tagScopeForView(currentView.value)
  try {
    libraryInfo.value = await deleteNotesFolder(path)
    clearCache()
    await noteStore.syncFromRemote()
    const viewFolder = folderPathFromView(currentView.value)
    if ((isFolderView(currentView.value) && (viewFolder === path || viewFolder.startsWith(path + '/')))
      || (scope && (scope.folderPath === path || scope.folderPath.startsWith(path + '/')))) setView(ROOT_VIEW)
    ElMessage.success('文件夹已删除')
  } catch (error) {
    logger.error('[笔记库] 删除文件夹失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error(error instanceof Error ? error.message : '删除文件夹失败')
  }
  folderDeleteVisible.value = false
}
const selectedNoteFolderOptions = computed(() => {
  if (!selectedNote.value) return []
  const outer = noteOuterFolderPath(selectedNote.value.folderPath)
  return folderRows.value.map(folder => folder.path).filter(path => noteOuterFolderPath(path) === outer)
})
const moveSelectedNoteToFolder = async (event: Event) => {
  const note = selectedNote.value
  if (!note || !libraryWritable.value) return
  const select = event.target as HTMLSelectElement
  const folderPath = select.value
  if (folderPath === (note.folderPath || '')) return
  if (noteOuterFolderPath(folderPath) !== noteOuterFolderPath(note.folderPath)) {
    select.value = note.folderPath || ''
    ElMessage.warning('笔记不能跨最外层文件夹移动；如需查看其他笔记库，请从侧栏切换')
    return
  }
  if (!await noteStore.moveNoteToFolder(note.id, folderPath)) {
    select.value = note.folderPath || ''
    ElMessage.error('移动笔记失败')
  } else {
    pageNav.setNavPath(['notes', folderViewId(folderPath), note.id])
    ElMessage.success(folderPath ? '已移动到「' + folderPath + '」' : '已移到未分类')
  }
}

const createNote = async () => {
  if (!libraryWritable.value) { ElMessage.warning('请先选择笔记库文件夹，再新建笔记'); return }
  const context = noteContextForView(currentView.value === 'trash' ? ROOT_VIEW : currentView.value)
  const note = await noteStore.addNote({
    title: '新笔记', content: '', tagIds: context.tagIds, folderPath: context.folderPath, pinned: false,
  })
  if (!note) return
  openNote(note)
  titleDraft.value = note.title
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select()
}
const togglePin = async (note: Note) => { await noteStore.togglePin(note.id) }

const showDeleteConfirm = ref(false)
const deletingId = ref<string | null>(null)
const deletingTitle = ref('')
const deletingFromTrash = ref(false)
const askDeleteNote = (note: Note) => {
  deletingId.value = note.id
  deletingTitle.value = note.title || '新笔记'
  deletingFromTrash.value = currentView.value === 'trash'
  showDeleteConfirm.value = true
}
const onDeleteConfirmed = async () => {
  const id = deletingId.value
  if (!id) return
  const wasActive = selectedId.value === id
  const tabIndex = openTabIds.value.indexOf(id)
  if (deletingFromTrash.value) {
    if (await noteStore.deleteNote(id)) ElMessage.success('已彻底删除')
  } else if (await noteStore.trashNote(id)) {
    ElMessage.success('已移入回收站')
  }
  if (!noteStore.notes.some(note => note.id === id) && openTabIds.value.includes(id)) openTabIds.value.splice(openTabIds.value.indexOf(id), 1)
  if (wasActive && !noteStore.notes.some(note => note.id === id)) {
    const fallback = openTabIds.value[tabIndex] || openTabIds.value[tabIndex - 1]
    if (fallback) openNote(fallback)
    else openStartTab()
  }
  deletingId.value = null
  showDeleteConfirm.value = false
}
const restoreNoteFromTrash = async (note: Note) => {
  if (await noteStore.restoreNote(note.id)) ElMessage.success('已恢复')
}
const showEmptyTrashConfirm = ref(false)
const askEmptyTrash = () => { if (noteStore.trashedNotes.length) showEmptyTrashConfirm.value = true }
const onEmptyTrashConfirmed = async () => {
  const count = await noteStore.emptyTrash()
  ElMessage.success('已清空 ' + count + ' 篇笔记')
  showEmptyTrashConfirm.value = false
}
const FIXED_NEW_NOTE_COMBO = 'Ctrl+N'
const FIXED_TAG_PICKER_COMBO = 'Ctrl+Shift+T'
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    const hadPopup = navDrawerOpen.value || tagPickerOpen.value || folderDialogVisible.value || libraryMenuOpen.value || libraryManagerVisible.value || sortMenuOpen.value || tabMenuOpen.value || splitMenuOpen.value
    navDrawerOpen.value = false
    tagPickerOpen.value = false
    folderDialogVisible.value = false
    libraryMenuOpen.value = false
    libraryManagerVisible.value = false
    sortMenuOpen.value = false
    tabMenuOpen.value = false
    splitMenuOpen.value = false
    if (!hadPopup && fullscreenEdit.value) fullscreenEdit.value = false
    return
  }
  const combo = comboFromEvent(event)
  if (combo === FIXED_TAG_PICKER_COMBO && selectedNote.value) {
    event.preventDefault()
    openTagPicker()
  } else if (combo === FIXED_NEW_NOTE_COMBO) {
    event.preventDefault()
    void createNote()
  }
}
const onResize = () => { if (window.innerWidth >= 1100) navDrawerOpen.value = false }
const onWindowFocus = () => { void noteStore.syncFromRemote() }
const onDocumentClick = () => {
  tagPickerOpen.value = false
  libraryMenuOpen.value = false
  sortMenuOpen.value = false
  tabMenuOpen.value = false
  splitMenuOpen.value = false
}
const initNavPath = async () => {
  let path = pageNav.navPath.value
  if (guideRunning.value) {
    if (path[0] !== 'notes') pageNav.setNavPath(['notes', ROOT_VIEW])
    sidebarPanel.value = 'files'
    startTabOpen.value = !path[2]
    startTabActive.value = !path[2]
    return
  }
  if (path[0] !== 'notes' || path.length < 2) path = await restoreModuleNavPath('notes')
  if (path[0] !== 'notes') path = ['notes', ROOT_VIEW]
  const view = path[1] || ROOT_VIEW
  if (view === 'favorites' || view === 'all') {
    const note = path[2] ? noteStore.notes.find(item => item.id === path[2]) : null
    path = note ? ['notes', folderViewId(note.folderPath || ''), note.id] : ['notes', ROOT_VIEW]
  } else if (path.length >= 3) {
    const note = noteStore.notes.find(item => item.id === path[2])
    if (note && !isFolderView(view)) path = ['notes', folderViewId(note.folderPath || ''), note.id]
    else if (!note) path = ['notes', view === 'trash' ? 'trash' : ROOT_VIEW]
  }
  const normalizedView = path[1] || ROOT_VIEW
  if (normalizedView === 'trash') sidebarPanel.value = 'trash'
  else if (isTagPathView(normalizedView) || normalizedView.startsWith('v:') || noteStore.tags.some(tag => tag.id === normalizedView)) sidebarPanel.value = 'tags'
  else sidebarPanel.value = 'files'
  startTabOpen.value = !path[2]
  startTabActive.value = !path[2]
  if (path[2] && !openTabIds.value.includes(path[2])) openTabIds.value.push(path[2])
  pageNav.setNavPath(path)
}
onMounted(async () => {
  emit('fullscreen-change', fullscreenEdit.value)
  await noteStore.loadData()
  try { libraryInfo.value = await getNotesLibraryInfo() }
  catch (error) { logger.error('[笔记库] 读取状态失败', { error: error instanceof Error ? error.message : String(error) }) }
  await initNavPath()
  void noteStore.syncFromRemote()
  window.addEventListener('focus', onWindowFocus)
  window.addEventListener('resize', onResize)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  emit('fullscreen-change', false)
  window.removeEventListener('focus', onWindowFocus)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
/*
  ⚠️ 全屏编辑（.notes-page.fs-edit）的规则**必须放在顶层**，不能放进宽度媒体查询。

  用户报告的缺陷：「笔记详情区域没有根据全屏/未全屏动态调整区域大小，
  未全屏时显示成全屏时的大小」。
  根因就是这里原本写成：

    @media (min-width: 1100px) {
      .np-nav, .np-list { transition: ... }
      .notes-page.fs-edit { gap: 0; }
      .notes-page.fs-edit .np-nav,
      .notes-page.fs-edit .np-list { display: none; }
    }

  这使「是否隐藏侧栏、编辑区是否铺满」取决于**窗口宽度**，而不是
  `fullscreenEdit` 这个**状态**。于是窗口窄于 1100 CSS px 时：
    · 进入全屏 → 隐藏侧栏的规则不生效 → 侧栏照旧、区域大小毫无变化；
    · 同时 max-width:1099 分支把 .np-nav 变成 position:fixed（脱离布局流），
      编辑区在任何状态下都近乎铺满。
  两种状态看起来一样 —— 正是用户描述的现象。

  现在把「状态相关」的规则上移到顶层（任何宽度都按状态生效），
  只把「宽度相关」的过渡留给媒体查询。

  ── 本轮（item 3）的变化 ──
  用户要求「点击笔记卡片进入笔记编辑页面，**全屏显示**」，
  并确认全屏指「覆盖整个应用窗口（连左侧模块导航栏一起隐藏）」。
  因此编辑页改为**真全屏覆盖层**：
    · 列表区变成占满宽度的卡片网格（一行最多 3 张，16:9）；
    · 选中笔记后，编辑区 fixed 覆盖整个窗口（inset:0, z-index 高于全局导航）；
    · 全屏状态由 selectedNote 派生（见 script 里的 watch），返回列表即退出。
*/

/* 全屏编辑：两个侧栏移除，编辑区自动铺满剩余宽度。 */
.notes-page.fs-edit {
  gap: 0;
}

.notes-page.fs-edit .np-nav,
.notes-page.fs-edit .np-list {
  display: none;
}

/*
  ====== 真全屏（item 3）======
  用户要求「点击笔记卡片进入笔记编辑页面，全屏显示」，
  并确认「覆盖整个应用窗口（连左侧模块导航栏一起隐藏）」。

  实现：编辑区 fixed 覆盖整个窗口。
    · inset:0 → 从窗口左上角开始，覆盖 MainNav（其 z-index:20）
    · z-index:50 → 高于 MainNav(20)、也高于列表内浮层
    · 背景用不透明底色 → 避免下层导航透出来
    · 内边距复刻 .notes-page 的 16px，保持与列表视图一致的呼吸感
  这样「返回」按钮回到列表时，导航栏随之回来（全屏状态由 selectedNote 派生）。
*/
.notes-page.fs-edit .np-editor {
  position: fixed;
  inset: 0;
  z-index: 50;
  padding: 16px;
  background: #0f0c29;
  overflow: hidden;
}

/* 编辑页头部的「返回」按钮：全屏时可见（列表视图下编辑区被 display:none 隐藏） */
.np-editor-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--chalk-white-70);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.np-editor-back:hover {
  background: rgba(102, 126, 234, 0.18);
  border-color: rgba(102, 126, 234, 0.45);
  color: #93c5fd;
}

/*
  编辑区宽度过渡：切换全屏时区域大小是平滑变化的，而不是瞬间跳变。
  transition 放在顶层：窄屏下同样需要（窄屏也会隐藏 .np-list）。
*/
.np-editor {
  transition: width 0.2s ease, flex-basis 0.2s ease;
}

/* 宽屏：双侧栏可收起（窄屏沿用抽屉交互） */
@media (min-width: 1100px) {
  .np-nav,
  .np-list {
    transition: width 0.2s ease, margin 0.2s ease, opacity 0.18s ease;
  }
}

.notes-page {
  position: relative;
  display: flex;
  gap: 12px;
  height: 100%;
  padding: 16px;
  overflow: hidden;
}

/* ====== 左栏：导航 ====== */
.np-nav {
  position: relative;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 220px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: visible;
}










.np-nav-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.np-nav-scroll::-webkit-scrollbar { width: 5px; }
.np-nav-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.np-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 2px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--chalk-white-70);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  text-align: left;
}

.np-nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--chalk-white-90);
}

.np-nav-item.active {
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
}

.np-nav-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-nav-count {
  font-size: 11px;
  color: var(--chalk-dim);
  font-variant-numeric: tabular-nums;
}

.np-nav-item.active .np-nav-count {
  color: rgba(147, 197, 253, 0.7);
}

.np-nav-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 10px 6px;
  font-size: 11px;
  color: var(--chalk-dim);
  letter-spacing: 1px;
}

.np-label-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--chalk-dim);
  cursor: pointer;
  font-size: 12px;
  letter-spacing: 0;
  transition: all 0.15s;
}

.np-label-add:hover {
  background: rgba(102, 126, 234, 0.2);
  color: #93c5fd;
}

.np-nav-tree {
  padding: 0 4px;
}

.np-drawer-mask {
  display: none;
}

/* ====== 中栏：列表（卡片网格）======
   用户要求：
     · 列表区右边界延伸到应用窗口右侧（保留一定间距）
     · 卡片 16:9，同行等高，一行最多 3 张
     · 判定：available < 800+d → 1 张；< 1200+2d → 2 张；否则 3 张（d=16）
   卡片宽由 grid 的 1fr 自动分配，因此只需给出列数（--np-card-cols，由 JS 测量容器宽度后计算）。
   之所以用 JS 测宽：列表区宽度取决于「侧栏是否收起 / 是否全屏编辑 / 窗口宽度」，
   与视口宽度并非一一对应（全屏编辑时视口不变但列表区消失），媒体查询判不准。
*/
.np-list {
  display: flex;
  flex-direction: column;
  /* 列表区占满可用宽度（右边界延伸到窗口右侧，间距由外层 padding 提供） */
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.np-list-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.np-nav-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.np-nav-toggle:hover {
  background: rgba(102, 126, 234, 0.15);
  color: #93c5fd;
}

.np-search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--chalk-dim);
  transition: border-color 0.2s;
}

.np-search:focus-within {
  border-color: rgba(102, 126, 234, 0.5);
}

.np-search input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--chalk-white-90);
  font-size: 13px;
  font-family: inherit;
}

.np-search input::placeholder {
  color: var(--chalk-dim);
}

.np-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 1px solid rgba(102, 126, 234, 0.4);
  border-radius: 8px;
  background: rgba(102, 126, 234, 0.2);
  color: #93c5fd;
  cursor: pointer;
  transition: all 0.2s;
}

.np-add-btn:hover {
  background: rgba(102, 126, 234, 0.35);
  color: var(--chalk-white);
}

.np-empty-trash {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 5px 10px;
  border: 1px solid rgba(245, 108, 108, 0.35);
  border-radius: 8px;
  background: rgba(245, 108, 108, 0.08);
  color: var(--chalk-red);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.np-empty-trash:hover {
  background: rgba(245, 108, 108, 0.18);
  border-color: rgba(245, 108, 108, 0.6);
}

.np-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /* 卡片网格：列数由 JS 按容器宽度算出（--np-card-cols），间隔用 --np-card-gap */
  display: grid;
  grid-template-columns: repeat(var(--np-card-cols, 1), minmax(0, 1fr));
  gap: var(--np-card-gap, 16px);
  align-content: start;
  /* 右侧留出滚动条槽位：自绘滚动条吸附容器右边界，而不是贴着卡片右边缘 */
  padding: 8px 18px 8px 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.np-list-scroll::-webkit-scrollbar { width: 5px; }
.np-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

.np-item {
  position: relative;
  display: flex;
  flex-direction: column;
  /* 撑满所在网格列（宽度由 1fr 决定） */
  width: 100%;
  min-width: 0;
  /* 16:9 宽高比（用户要求） */
  aspect-ratio: 16 / 9;
  /*
    三段式纵向布局（用户反馈「卡片布局不太行」）：
      ① 标题行（最多 2 行）
      ② 摘要（flex:1，吃满中间弹性区域，多行截断）
      ③ 元信息（钉在底部）
    此前内容总高仅约 69px，而 16:9 的卡片高约 280px → **约 75% 是空白**，
    这才是「布局不太行」的根源。现在让摘要占据剩余空间，卡片被填满。
  */
  padding: 12px 14px;
  /* 用户要求「给笔记卡片加上背景框」：常态即有可见的底色 + 边框，
     不再依赖 hover 才显现（此前 background 为 transparent，卡片像"浮"在面板上）。 */
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  overflow: hidden;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

/* 同行卡片等高：grid 默认 stretch，卡片已由 aspect-ratio 决定高度；
   同一行内显式拉伸，避免内容多少不同导致高度不一致。 */
.np-list-scroll > .np-item {
  align-self: stretch;
}

.np-item:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
}

.np-item.active {
  background: rgba(102, 126, 234, 0.16);
  border-color: rgba(102, 126, 234, 0.45);
}

.np-item-top {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  flex-shrink: 0;
}

.np-item-title {
  flex: 1;
  min-width: 0;
  /* 标题最多 2 行：卡片够高，允许长标题换行比强制单行省略更易读 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--chalk-white-90);
  word-break: break-word;
}

.np-item.active .np-item-title {
  color: #93c5fd;
}

/*
  操作按钮：常态**占据布局空间但不可见**，悬停/聚焦/选中时才显现。
  为什么不用绝对定位浮在右上角：卡片标题现在可占 2 行，浮层会与文字重叠。
  保留占位则标题宽度稳定、不会因按钮出现而跳动；pointer-events 防止误点。
*/
.np-item-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-top: -2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.np-item:hover .np-item-actions,
.np-item:focus-within .np-item-actions,
.np-item.active .np-item-actions {
  opacity: 1;
  pointer-events: auto;
}

.np-item-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--chalk-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.np-item-btn:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--chalk-white);
}

.np-item-btn.on {
  color: var(--chalk-amber);
}

.np-item-btn.danger:hover {
  background: rgba(245, 108, 108, 0.18);
  color: var(--chalk-red);
}

/*
  摘要：占据标题与元信息之间的全部剩余高度（flex:1）。
  多行截断而非单行 nowrap —— 卡片高约 280px，单行摘要会浪费纵向空间。

  line-clamp 取 20：实测最极端情况（1 列、卡片高 428px）摘要区约 327px、
  约 15 行，因此 20 行足够覆盖所有窗口尺寸，实际截断交给容器高度
  （overflow:hidden + 底部渐隐 mask），不会再出现「文字只占 12 行、
  下方留 80px 空白」的情况。
*/
.np-item-excerpt {
  flex: 1;
  min-height: 0;
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--chalk-dim);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 20;
  overflow: hidden;
  word-break: break-word;
  /* 底部渐隐：内容被高度截断时不会出现生硬的半行切口 */
  mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000 78%, transparent 100%);
}

.np-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  /* 钉在卡片底部：与上方标题/摘要形成稳定的三段结构 */
  margin-top: auto;
  padding-top: 8px;
  min-width: 0;
  flex-shrink: 0;
}

.np-item-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
}

.np-item-tag {
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1.5;
  opacity: 0.85;
}

.np-item-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--chalk-dim);
}

.np-empty {
  /* 空状态是网格的子元素，必须跨满所有列，否则会被挤进第一列 */
  grid-column: 1 / -1;
  padding: 40px 16px;
  text-align: center;
  color: var(--chalk-muted);
  font-size: 13px;
}

.np-empty-sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--chalk-dim);
}

/* ====== 右栏：编辑器 ====== */
.np-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/*
  未选中笔记时，编辑区**不占位**（否则它 flex:1 会与列表各占一半宽度，
  列表就只有窗口一半宽、卡片放不下 2~3 列 —— 正是用户截图里的现象）。
  选中笔记时才渲染（.editor-open）并由 fs-edit 的 fixed 覆盖层铺满全屏。
  用户已要求删掉「未选中」时的占位提示区，因此这里直接隐藏。
*/
.np-editor:not(.editor-open) {
  display: none;
}

.np-editor-main {
  flex: 1;
  min-height: 0;
  /* flex 项需允许横向收缩，避免内部较宽内容把容器撑出父级（右侧被裁） */
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/*
  ⚠️ 这段样式（.np-editor-head / .np-title-input）是上一轮误删后补回的。
  原因：上一轮删「反向链接面板」CSS 时，我按行号范围删除，
  结果把紧邻其后的这两条规则一起删掉了 —— 表现就是笔记详情页顶部标题
  失去样式（变成默认白色输入框、被挤到单独一行），即用户截图里的样子。
  现在标题、文件路径、「原地保存」在同一行显示：head 用 flex 横向排列，
  标题占满剩余宽度，路径与徽标按内容宽度收缩。
*/
.np-editor-head {
  /* 标题、文件路径、「原地保存」徽标同一行；gap 提供「挨着但有间距」的观感 */
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 4px 16px 10px;
}

.np-title-input {
  /*
    标题不再「占满剩余宽度」（旧写法 flex: 1 1 auto 会把路径与徽标顶到最右侧，
    视觉上彼此离得很远）。改为按内容自适应宽度，用 field-sizing: content
    让输入框随标题文字长度伸缩；再配合 min/max 宽度兜底，
    这样标题、路径、徽标会自然挨在一起，同时保留 10px 的间距。
  */
  flex: 0 1 auto;
  field-sizing: content;
  min-width: 6ch;
  /* 上限避免超长标题把路径挤到下一行；超出部分输入框内部滚动 */
  max-width: 55%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--chalk-white-95);
  font-size: 20px;
  font-weight: 700;
  font-family: inherit;
  padding: 6px 4px;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

.np-title-input:focus {
  border-bottom-color: rgba(102, 126, 234, 0.4);
}

.np-title-input::placeholder {
  color: var(--chalk-dim);
}

/* 编辑主体：菜单栏 → 状态栏这一段；反向链接面板与编辑器组件同行同高。
   --editor-outer-gap 由编辑器组件与面板共享，保证面板上下边界
   严格对齐菜单栏上边界与状态栏下边界。 */
.np-editor-body {
  --editor-outer-gap: 16px;
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  gap: 12px;
}

.np-editor-col {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}


/* ====== 属性栏：标签（紧跟标题同行）====== */
.np-props {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  margin-top: 0;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 4px;
}

.np-props-tags {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.np-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px 2px 8px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.5;
  opacity: 0.9;
}

.np-tag-x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 9px;
  opacity: 0.6;
  transition: all 0.15s;
}

.np-tag-x:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.np-tag-add {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: transparent;
  color: var(--chalk-muted);
  font-size: 11px;
  line-height: 1.5;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.np-tag-add:hover {
  border-color: rgba(102, 126, 234, 0.5);
  color: #93c5fd;
}

.np-tag-picker {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 45;
  width: 260px;
  padding: 8px;
  background: rgba(23, 22, 48, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.np-tag-input {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  outline: none;
  background: rgba(255, 255, 255, 0.04);
  color: var(--chalk-white-90);
  font-size: 12px;
  font-family: inherit;
}

.np-tag-input:focus {
  border-color: rgba(102, 126, 234, 0.5);
}

.np-tag-input::placeholder {
  color: var(--chalk-dim);
}

.np-tag-sugs {
  margin-top: 6px;
  max-height: 220px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.np-tag-sug {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chalk-white-75);
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.1s;
}

.np-tag-sug.hl {
  background: rgba(102, 126, 234, 0.18);
  color: #93c5fd;
}

.np-tag-sug-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.np-tag-sug-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-tag-sug-sub {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--chalk-dim);
}

.np-tag-sug-empty {
  padding: 8px;
  font-size: 11px;
  color: var(--chalk-dim);
}

/* ====== 通用过渡 ====== */
.np-fade-enter-active,
.np-fade-leave-active {
  transition: opacity 0.15s ease;
}

.np-fade-enter-from,
.np-fade-leave-to {
  opacity: 0;
}

/* ====== 窄屏降级 ====== */
/* < 1100px：左栏收起为抽屉，由列表头部的导航按钮呼出 */
@media (max-width: 1099px) {
  .np-nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 60;
    border-radius: 0 12px 12px 0;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    background: rgba(20, 18, 44, 0.98);
  }

  .np-nav.drawer-open {
    transform: translateX(0);
  }

  .np-drawer-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 55;
    background: rgba(0, 0, 0, 0.45);
  }

  .np-nav-toggle {
    display: flex;
  }

  /* 列表区仍占满可用宽度（网格列数由 JS 按实际宽度算，这里不设固定宽） */
}

/* < 900px：列表优先，编辑器整屏下钻（小米笔记/锤子便签式） */
@media (max-width: 899px) {
  .notes-page {
    padding: 10px;
    gap: 10px;
  }

  /*
    窄屏下编辑区默认不渲染（选中笔记后由 .notes-page.fs-edit .np-editor
    的 fixed 全屏覆盖层接管 —— 见文件开头的说明）。
    这里保留一条兜底：万一 fs-edit 未生效（例如状态尚未同步），
    仍用 editor-open 把编辑区铺满，避免「点了卡片看不到编辑区」。
  */
  .np-editor {
    display: none;
  }

  .np-editor.editor-open {
    display: flex;
    position: absolute;
    inset: 0;
    z-index: 40;
    padding: 10px;
    background: #0f0c29;
    overflow-y: auto;
  }
}

/* Obsidian-style file explorer and workspace */
.notes-page { height:100%; min-height:0; gap:0; padding:0; background:transparent; }
.notes-page.fs-edit .np-nav { display:none; }
.np-nav {
  width:268px; flex:0 0 268px; position:relative; z-index:30; border:0;
  border-right:1px solid rgba(255,255,255,.08); border-radius:0;
  background:rgba(37,33,63,.96); overflow:visible;
}
.np-sidebar-header { display:flex; align-items:center; justify-content:space-between; height:42px; padding:0 12px 0 16px; flex:0 0 auto; }
.np-sidebar-heading { display:flex; align-items:center; gap:8px; color:var(--chalk-white-85); font-size:12px; font-weight:700; letter-spacing:.04em; }
.np-sidebar-heading .el-icon { color:var(--chalk-muted); font-size:15px; }
.np-sidebar-actions { display:flex; align-items:center; gap:3px; }
.np-file-actions { width:100%; justify-content:center; gap:5px; }
.np-sidebar-actions button, .np-sidebar-icon-button {
  display:grid; place-items:center; position:relative; width:26px; height:26px; padding:0;
  border:0; border-radius:6px; background:transparent; color:var(--chalk-muted); cursor:pointer;
}
.np-sidebar-actions button:hover, .np-sidebar-icon-button:hover { background:rgba(255,255,255,.08); color:var(--chalk-white-90); }
.np-sidebar-actions button:disabled { opacity:.35; cursor:not-allowed; }
.np-sidebar-actions sup { position:absolute; top:2px; right:3px; font-size:9px; }
.np-sort-control { position:relative; display:flex; align-items:center; }
.np-sort-menu { position:absolute; top:calc(100% + 5px); left:-68px; z-index:100; width:236px; padding:5px; border:1px solid rgba(255,255,255,.12); border-radius:9px; background:var(--chalk-card,#211d3b); box-shadow:0 12px 32px rgba(0,0,0,.42); }
.np-sort-menu button { display:flex; align-items:center; justify-content:space-between; width:100%; height:31px; padding:0 8px; border:0; border-radius:5px; background:transparent; color:rgba(255,255,255,.78); font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.np-sort-menu button:hover, .np-sort-menu button.active { background:rgba(255,255,255,.08); color:rgba(255,255,255,.96); }
.np-sort-menu button .el-icon { color:#c4b5fd; }
.np-search { flex:0 0 auto; margin:0 10px 8px; padding:6px 8px; border-radius:6px; }
.np-search input { font-size:12px; }
.np-search > button { display:grid; place-items:center; width:18px; height:18px; padding:0; border:0; border-radius:4px; background:transparent; color:var(--chalk-dim); cursor:pointer; }
.np-nav-scroll { padding:2px 7px 8px; }
.np-tree-root, .np-tree-entry { position:relative; display:flex; align-items:center; min-width:0; height:28px; margin:1px 0; border-radius:5px; color:var(--chalk-white-70); }
.np-tree-root.active, .np-tree-entry.active { background:rgba(147,197,253,.13); color:#bfdbfe; }
.np-tree-row { display:flex; align-items:center; gap:6px; width:100%; min-width:0; height:28px; padding:0 7px; border:0; border-radius:5px; background:transparent; color:inherit; font:inherit; font-size:12px; text-align:left; cursor:pointer; }
.np-tree-row:hover { background:rgba(255,255,255,.055); color:var(--chalk-white-90); }
.np-tree-label { min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-tree-chevron, .np-tree-chevron-spacer { display:grid; place-items:center; flex:0 0 13px; width:13px; height:18px; color:var(--chalk-dim); }
.np-tree-chevron { cursor:pointer; transition:transform .13s ease; }
.np-tree-chevron.expanded { transform:rotate(90deg); }
.np-tree-chevron .el-icon { font-size:11px; }
.np-tree-item-icon { flex:0 0 auto; color:var(--chalk-muted); font-size:14px; }
.np-tree-pin { color:#c4b5fd; font-size:18px; line-height:1; }
.np-tree-actions { position:absolute; right:3px; display:flex; align-items:center; gap:1px; opacity:0; background:var(--chalk-card,#211d3b); }
.np-tree-entry:hover .np-tree-actions, .np-tree-entry:focus-within .np-tree-actions { opacity:1; }
.np-tree-actions button { display:grid; place-items:center; width:22px; height:22px; padding:0; border:0; border-radius:4px; background:transparent; color:var(--chalk-muted); cursor:pointer; }
.np-tree-actions button:hover { background:rgba(255,255,255,.1); color:var(--chalk-white-90); }
.np-tree-actions button:last-child:hover { color:#fb7185; }
.np-tree-empty { padding:10px 8px; color:var(--chalk-dim); font-size:11px; line-height:1.5; }
.np-tag-tree { padding:0 2px; }
.np-workspace { position:relative; display:flex; flex:1; flex-direction:column; min-width:0; min-height:0; overflow:hidden; padding:16px 22px; }
.np-tabbar { position:relative; z-index:10; display:flex; flex:0 0 40px; align-items:center; gap:6px; margin:-16px -22px 12px; padding:0 10px; border-bottom:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.025); }
.np-tabbar.stacked { height:auto; min-height:40px; flex-basis:auto; align-items:flex-start; padding-top:3px; }
.np-tab-strip { display:flex; flex:1; align-items:flex-end; gap:3px; min-width:0; height:100%; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; }
.np-tabbar.stacked .np-tab-strip { flex-wrap:wrap; align-content:flex-start; align-items:flex-start; height:auto; max-height:88px; overflow-y:auto; padding-top:3px; }
.np-tab { display:flex; flex:0 1 220px; align-items:center; gap:7px; min-width:94px; max-width:240px; height:33px; margin-top:7px; padding:0 9px; border:1px solid transparent; border-bottom:0; border-radius:8px 8px 0 0; background:transparent; color:var(--chalk-muted); font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.np-tab:hover { background:rgba(255,255,255,.045); color:var(--chalk-white-85); }
.np-tab.active { border-color:rgba(255,255,255,.1); background:var(--chalk-bg,#15122b); color:var(--chalk-white-90); }
.np-tab-file { flex:0 0 auto; color:var(--chalk-dim); font-size:13px; }
.np-tab-title { min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-tab-close { display:grid; flex:0 0 17px; place-items:center; width:17px; height:17px; border-radius:4px; color:var(--chalk-dim); opacity:0; }
.np-tab:hover .np-tab-close, .np-tab.active .np-tab-close { opacity:1; }
.np-tab-close:hover { background:rgba(255,255,255,.12); color:var(--chalk-white-95); }
.np-tab-close .el-icon { font-size:12px; }
.np-tab-controls { display:flex; flex:0 0 auto; align-items:center; gap:3px; height:100%; }
.np-tab-control { display:grid; place-items:center; width:28px; height:28px; padding:0; border:0; border-radius:6px; background:transparent; color:var(--chalk-muted); cursor:pointer; }
.np-tab-control:hover, .np-tab-control[aria-expanded="true"] { background:rgba(255,255,255,.08); color:var(--chalk-white-90); }
.np-tab-control .el-icon { font-size:15px; }
.np-tab-menu-wrap { position:relative; }
.np-tab-menu { position:absolute; top:calc(100% + 5px); right:0; z-index:80; width:176px; padding:5px; border:1px solid rgba(255,255,255,.12); border-radius:9px; background:var(--chalk-card,#211d3b); box-shadow:0 12px 32px rgba(0,0,0,.42); }
.np-tab-menu button { display:flex; align-items:center; gap:8px; width:100%; min-height:32px; padding:0 9px; border:0; border-radius:5px; background:transparent; color:var(--chalk-white-80); font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.np-tab-menu button:hover, .np-tab-menu button.active { background:rgba(255,255,255,.08); color:var(--chalk-white-95); }
.np-tab-menu button .el-icon { color:var(--chalk-muted); font-size:14px; }
.np-workspace-content { display:flex; flex:1; min-width:0; min-height:0; overflow:hidden; }
.np-workspace-primary { display:flex; flex:1 1 0; min-width:0; min-height:0; flex-direction:column; overflow:hidden; }
.np-workspace-content.is-split-vertical { flex-direction:row; }
.np-workspace-content.is-split-horizontal { flex-direction:column; }
.np-secondary-pane { display:flex; flex:1 1 0; min-width:0; min-height:0; flex-direction:column; overflow:hidden; border-left:1px solid rgba(255,255,255,.1); }
.np-workspace-content.is-split-horizontal .np-secondary-pane { border-top:1px solid rgba(255,255,255,.1); border-left:0; }
.np-secondary-header { display:flex; flex:0 0 36px; align-items:center; gap:6px; padding:0 8px; border-bottom:1px solid rgba(255,255,255,.07); }
.np-secondary-header select { flex:1; min-width:0; height:26px; padding:0 7px; border:1px solid rgba(255,255,255,.1); border-radius:5px; outline:0; background:var(--chalk-card,#211d3b); color:var(--chalk-white-85); font:inherit; font-size:11px; }
.np-secondary-header button { display:grid; place-items:center; flex:0 0 24px; width:24px; height:24px; padding:0; border:0; border-radius:5px; background:transparent; color:var(--chalk-muted); cursor:pointer; }
.np-secondary-header button:hover { background:rgba(255,255,255,.08); color:var(--chalk-white-90); }
.np-secondary-editor { display:flex; flex:1; min-width:0; min-height:0; flex-direction:column; overflow:hidden; padding:8px 10px 0; }
.np-secondary-editor h2 { flex:0 0 auto; margin:0 0 8px; overflow:hidden; color:var(--chalk-white-90); font-size:16px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.np-secondary-editor :deep(.editor-wrap) { flex:1; min-height:0; }
.np-secondary-empty { display:flex; flex:1; align-items:center; justify-content:center; flex-direction:column; gap:8px; color:var(--chalk-dim); font-size:11px; }
.np-secondary-empty .el-icon { color:var(--chalk-muted); font-size:22px; }
.np-editor { display:flex !important; flex:1; min-width:0; min-height:0; background:transparent; border:0; border-radius:0; overflow:hidden; }
.np-editor-main { width:100%; }
.np-editor-head { padding:4px 2px 12px; border-bottom:1px solid rgba(255,255,255,.07); }
.np-editor-body { position:relative; padding-top:12px; }
.np-mobile-nav-toggle { display:none; }
.np-empty-state { display:flex; flex:1; min-height:0; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:var(--chalk-muted); text-align:center; }
.np-empty-state > .el-icon { color:rgba(147,197,253,.6); font-size:30px; }
.np-empty-state strong { color:var(--chalk-white-85); font-size:15px; font-weight:600; }
.np-empty-state > span { color:var(--chalk-dim); font-size:12px; }
.np-empty-state > button { display:inline-flex; align-items:center; gap:6px; margin-top:4px; padding:7px 12px; border:1px solid rgba(147,197,253,.28); border-radius:7px; background:rgba(102,126,234,.16); color:#bfdbfe; font:inherit; font-size:12px; cursor:pointer; }
.np-empty-state > button:hover { background:rgba(102,126,234,.26); }
.np-trash-view { display:flex; flex:1; min-height:0; flex-direction:column; max-width:1000px; width:100%; margin:0 auto; }
.np-trash-header { display:flex; align-items:center; justify-content:space-between; padding:2px 2px 14px; border-bottom:1px solid rgba(255,255,255,.08); }
.np-trash-header h2 { margin:0; color:var(--chalk-white-90); font-size:19px; }
.np-trash-header p { margin:5px 0 0; color:var(--chalk-dim); font-size:11px; }
.np-empty-trash { display:flex; align-items:center; gap:6px; padding:6px 9px; border:1px solid rgba(245,108,108,.3); border-radius:7px; background:rgba(245,108,108,.08); color:var(--chalk-red); font:inherit; font-size:11px; cursor:pointer; }
.np-empty-trash:disabled { opacity:.4; cursor:not-allowed; }
.np-trash-list { flex:1; min-height:0; overflow:auto; padding:8px 2px; }
.np-trash-item { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 9px; border-bottom:1px solid rgba(255,255,255,.055); }
.np-trash-item-copy { display:flex; min-width:0; flex-direction:column; gap:4px; }
.np-trash-item-copy strong { overflow:hidden; color:var(--chalk-white-85); font-size:13px; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
.np-trash-item-copy span { color:var(--chalk-dim); font-size:10px; }
.np-trash-item-actions { display:flex; flex:0 0 auto; gap:5px; }
.np-trash-item-actions button { display:flex; align-items:center; gap:4px; padding:5px 7px; border:1px solid rgba(255,255,255,.09); border-radius:6px; background:rgba(255,255,255,.035); color:var(--chalk-muted); font:inherit; font-size:10px; cursor:pointer; }
.np-trash-item-actions button:hover { color:var(--chalk-white-90); background:rgba(255,255,255,.08); }
.np-trash-item-actions button.danger:hover { color:#fb7185; border-color:rgba(251,113,133,.35); }
.np-library-readonly-mask {
  position:absolute; inset:0; z-index:40; display:grid; place-items:center;
  background:color-mix(in srgb, var(--chalk-bg, #15122b) 48%, transparent);
  backdrop-filter:blur(2px);
}
.np-library-readonly-card {
  display:flex; align-items:center; flex-direction:column; gap:9px; max-width:300px;
  padding:22px; border:1px solid rgba(255,255,255,.1); border-radius:12px;
  background:var(--chalk-card,#211d3b); color:var(--chalk-muted); text-align:center;
  box-shadow:0 12px 35px rgba(0,0,0,.24);
}
.np-library-readonly-card > .el-icon { color:#93c5fd; font-size:24px; }
.np-library-readonly-card strong { color:var(--chalk-white-90); font-size:14px; }
.np-library-readonly-card span { color:var(--chalk-dim); font-size:11px; line-height:1.5; }
.np-library-readonly-card button {
  padding:6px 10px; border:1px solid rgba(147,197,253,.24); border-radius:6px;
  background:rgba(102,126,234,.12); color:#bfdbfe; font:inherit; font-size:11px; cursor:pointer;
}
.np-library-readonly-card button:hover { background:rgba(102,126,234,.22); }
.np-sidebar-toolbar {
  display:flex; flex:0 0 40px; align-items:center; justify-content:flex-start; gap:4px;
  padding:0 10px; border-bottom:1px solid rgba(255,255,255,.07);
}
.np-sidebar-toolbar button {
  display:grid; place-items:center; width:28px; height:28px; padding:0;
  border:0; border-radius:6px; background:transparent; color:var(--chalk-muted); cursor:pointer;
}
.np-sidebar-toolbar button:hover { background:rgba(255,255,255,.07); color:var(--chalk-white-90); }
.np-sidebar-toolbar button.active { background:rgba(147,197,253,.14); color:#bfdbfe; }
.np-sidebar-toolbar button .el-icon { font-size:16px; }
.np-sidebar-panel { display:flex; flex:1; min-height:0; flex-direction:column; overflow:hidden; }
.np-sidebar-panel .np-sidebar-header { height:38px; padding:0 10px 0 14px; }
.np-sidebar-panel .np-sidebar-heading .el-icon { font-size:14px; }
.np-sidebar-icon-button:disabled { opacity:.35; cursor:not-allowed; }
.np-nav-scroll { flex:1; min-height:0; overflow-y:auto; }
.np-search { display:flex; align-items:center; gap:7px; margin:1px 10px 9px; padding:6px 8px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.035); }
.np-search input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:var(--chalk-white-90); }
.np-search-results, .np-tag-note-list { flex:1; min-height:0; overflow:auto; padding:0 7px 10px; }
.np-search-result { display:flex; align-items:center; gap:8px; width:100%; min-width:0; padding:7px 8px; border:0; border-radius:6px; background:transparent; color:var(--chalk-white-70); text-align:left; cursor:pointer; }
.np-search-result:hover, .np-search-result.active { background:rgba(147,197,253,.12); color:var(--chalk-white-90); }
.np-search-result > .el-icon { flex:0 0 auto; color:var(--chalk-muted); }
.np-search-result > span { display:flex; min-width:0; flex:1; flex-direction:column; gap:3px; }
.np-search-result strong { overflow:hidden; font-size:11px; font-weight:500; text-overflow:ellipsis; white-space:nowrap; }
.np-search-result small { overflow:hidden; color:var(--chalk-dim); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.np-tags-panel .np-tag-tree { flex:1; min-height:0; overflow:auto; padding:0 7px; }
.np-tag-note-list { flex:0 1 42%; border-top:1px solid rgba(255,255,255,.07); }
.np-tag-note-list-heading { display:flex; align-items:center; justify-content:space-between; padding:9px 8px 5px; color:var(--chalk-muted); font-size:10px; }
.np-tag-note-list-heading span { color:var(--chalk-dim); }
.np-trash-sidebar p { margin:4px 14px; color:var(--chalk-dim); font-size:11px; line-height:1.6; }
.np-library-footer { position:relative; padding:7px 10px; }
.np-library-switcher { position:relative; width:100%; }
.np-library-switcher-button { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; min-width:0; height:34px; padding:0 8px; border:0; border-radius:6px; background:transparent; color:rgba(255,255,255,.9); font:inherit; font-size:12px; font-weight:600; text-align:center; cursor:pointer; }
.np-library-switcher-button:hover { background:rgba(255,255,255,.07); color:#fff; }
.np-library-switcher-icon { flex:0 0 auto; color:#b8a0ff; font-size:16px; }
.np-library-switcher-chevron { flex:0 0 auto; color:var(--chalk-white-70); font-size:12px; transition:transform .16s ease; }
.np-library-switcher-button[aria-expanded="true"] .np-library-switcher-chevron { transform:rotate(180deg); }
.np-library-switcher-button span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-library-menu { position:absolute; bottom:calc(100% + 8px); left:0; z-index:90; box-sizing:border-box; width:100%; min-width:0; max-width:100%; max-height:min(420px, 70vh); overflow:auto; padding:6px; border:1px solid rgba(255,255,255,.11); border-radius:9px; background:var(--chalk-card,#211d3b); box-shadow:0 14px 40px rgba(0,0,0,.42); }
.np-library-menu-heading { padding:7px 9px 6px; color:var(--chalk-dim); font-size:10px; }
.np-library-menu-item { display:flex; align-items:center; gap:8px; width:100%; padding:7px 8px; border:0; border-radius:6px; background:transparent; color:var(--chalk-white-75); text-align:left; cursor:pointer; }
.np-library-menu-item:hover, .np-library-menu-item.active { background:rgba(147,197,253,.11); color:var(--chalk-white-90); }
.np-library-menu-item:disabled { opacity:.45; cursor:not-allowed; }
.np-library-menu-item > .el-icon:first-child { flex:0 0 auto; color:#93c5fd; }
.np-library-menu-item > span { display:flex; min-width:0; flex:1; flex-direction:column; gap:3px; }
.np-library-menu-item strong { font-size:11px; font-weight:500; }
.np-library-menu-item small { overflow:hidden; color:var(--chalk-dim); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.np-library-menu-check { color:#93c5fd; }
.np-library-menu-empty { padding:10px 9px; color:var(--chalk-dim); font-size:10px; }
.np-library-menu-divider { height:1px; margin:5px 3px; background:rgba(255,255,255,.08); }
.np-library-menu-manage { display:flex; align-items:center; gap:8px; width:100%; padding:8px 9px; border:0; border-radius:6px; background:transparent; color:var(--chalk-white-85); font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.np-library-menu-manage:hover { background:rgba(255,255,255,.07); color:var(--chalk-white-95); }
.np-library-manager-mask { position:fixed; inset:0; z-index:3000; display:grid; place-items:center; padding:24px; background:rgba(4,3,12,.72); backdrop-filter:blur(5px); }
.np-library-manager { display:grid; grid-template-columns:minmax(220px, 35%) minmax(0,1fr); width:min(980px, 94vw); height:min(760px, 88vh); overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:12px; background:#1c1c1c; box-shadow:0 24px 80px rgba(0,0,0,.5); color:var(--chalk-white-90); }
.np-library-manager-list { min-width:0; padding:22px 16px; overflow:auto; background:#262626; border-right:1px solid rgba(255,255,255,.08); }
.np-library-manager-entry { display:flex; align-items:center; gap:8px; width:100%; margin:3px 0; padding:9px 7px; border:0; border-radius:6px; background:transparent; color:var(--chalk-white-85); text-align:left; cursor:pointer; }
.np-library-manager-entry:hover, .np-library-manager-entry.active { background:rgba(255,255,255,.07); }
.np-library-manager-entry:disabled { opacity:.45; cursor:not-allowed; }
.np-library-manager-entry > span:first-child { display:flex; min-width:0; flex:1; flex-direction:column; gap:3px; }
.np-library-manager-entry strong { font-size:12px; font-weight:500; }
.np-library-manager-entry small { overflow:hidden; color:var(--chalk-dim); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.np-library-manager-entry-status { flex:0 0 auto; color:#c4b5fd; font-size:9px; }
.np-library-manager-empty { padding:12px 7px; color:var(--chalk-dim); font-size:11px; }
.np-library-manager-main { position:relative; display:grid; place-items:center; min-width:0; padding:44px 28px 28px; background:#1c1c1c; }
.np-library-manager-close { position:absolute; top:12px; right:12px; display:grid; place-items:center; width:30px; height:30px; border:0; border-radius:6px; background:transparent; color:var(--chalk-muted); cursor:pointer; }
.np-library-manager-close:hover { background:rgba(255,255,255,.08); color:var(--chalk-white-95); }
.np-library-manager-content { width:min(100%, 560px); }
.np-library-manager-options { padding:8px 22px; border-radius:14px; background:rgba(255,255,255,.045); text-align:left; }
.np-library-manager-options section { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:17px 2px; border-bottom:1px solid rgba(255,255,255,.08); }
.np-library-manager-options section:last-child { border-bottom:0; }
.np-library-manager-options strong { color:var(--chalk-white-90); font-size:13px; font-weight:600; }
.np-library-manager-options p { margin:5px 0 0; color:var(--chalk-muted); font-size:11px; line-height:1.5; }
.np-library-manager-options button { flex:0 0 112px; padding:9px 14px; border:1px solid rgba(255,255,255,.1); border-radius:7px; background:rgba(255,255,255,.08); color:var(--chalk-white-90); font:inherit; font-size:12px; cursor:pointer; }
.np-library-manager-options button:hover { background:rgba(255,255,255,.13); }
.np-library-manager-options button.primary { border-color:#8757e8; background:#8757e8; color:#fff; }
.np-library-manager-options button.primary:hover { background:#9668f0; }
.np-tag-results-view { display:flex; flex:1; min-height:0; flex-direction:column; max-width:1000px; width:100%; margin:0 auto; }
.np-tag-results-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); align-content:start; gap:10px; flex:1; min-height:0; overflow:auto; padding:14px 2px; }
.np-tag-result-card { display:flex; min-width:0; flex-direction:column; gap:5px; padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:8px; background:rgba(255,255,255,.025); color:var(--chalk-white-85); text-align:left; cursor:pointer; }
.np-tag-result-card:hover { border-color:rgba(147,197,253,.28); background:rgba(147,197,253,.06); }
.np-tag-result-card strong { overflow:hidden; font-size:13px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.np-tag-result-card span { color:#93c5fd; font-size:10px; }
.np-tag-result-card small { display:-webkit-box; overflow:hidden; color:var(--chalk-dim); font-size:10px; line-height:1.5; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
@media (max-width: 1099px) {
  .np-nav { position:fixed; inset:0 auto 0 0; z-index:60; width:min(300px,86vw); flex-basis:268px; transform:translateX(-102%); transition:transform .2s ease; background:rgba(37,33,63,.99); box-shadow:12px 0 35px rgba(0,0,0,.3); }
  .np-nav.drawer-open { transform:translateX(0); }
  .np-drawer-mask { display:block; position:fixed; inset:0; z-index:55; background:rgba(0,0,0,.45); }
  .np-mobile-nav-toggle { display:grid; place-items:center; position:absolute; top:4px; left:4px; z-index:5; width:30px; height:30px; border:0; border-radius:6px; background:rgba(255,255,255,.05); color:var(--chalk-muted); cursor:pointer; }
  .np-workspace { padding:42px 14px 12px; }
  .np-tabbar { margin:-42px -14px 10px; padding-left:42px; }
  .np-mobile-nav-toggle { z-index:15; }
  .notes-page.fs-edit .np-workspace { padding:16px; }
}
@media (max-width: 620px) {
  .np-workspace { padding:42px 8px 8px; }
  .np-tabbar { margin:-42px -8px 8px; padding-left:42px; }
  .np-tab { flex-basis:160px; }
  .np-workspace-content.is-split-vertical { flex-direction:column; }
  .np-workspace-content.is-split-vertical .np-secondary-pane { border-top:1px solid rgba(255,255,255,.1); border-left:0; }
  .np-editor-head { align-items:flex-start; flex-direction:column; }
  .np-props { padding:0; }
  .np-trash-item { align-items:flex-start; flex-direction:column; }
}
@media (max-width: 700px) {
  .np-library-manager-mask { padding:12px; }
  .np-library-manager { grid-template-columns:1fr; grid-template-rows:minmax(100px, 28%) minmax(0,1fr); width:100%; height:min(700px,94vh); }
  .np-library-manager-list { padding:12px; border-right:0; border-bottom:1px solid rgba(255,255,255,.08); }
  .np-library-manager-entry { display:inline-flex; width:min(260px,100%); }
  .np-library-manager-main { padding:34px 14px 18px; }
  .np-library-manager-options { padding:4px 12px; }
  .np-library-manager-options section { gap:8px; padding:13px 0; }
  .np-library-manager-options button { flex-basis:74px; }
}
</style>
