<template>
  <div class="notes-page">
    <aside class="np-nav" :class="{ 'is-collapsed': sidebarCollapsed, 'is-resizing': sidebarResizing }"
      :style="{ width: sidebarCollapsed ? SIDEBAR_RAIL_WIDTH + 'px' : sidebarWidth + 'px', flexBasis: sidebarCollapsed ? SIDEBAR_RAIL_WIDTH + 'px' : sidebarWidth + 'px' }">
      <div class="np-sidebar-toolbar" role="toolbar" aria-label="笔记侧栏视图">
        <button type="button" title="文件列表" aria-label="文件列表" :aria-pressed="sidebarPanel === 'files'" :class="{ active: sidebarPanel === 'files' }" @click="showSidebarPanel('files')"><el-icon><Files /></el-icon></button>
        <button type="button" title="搜索" aria-label="搜索" :aria-pressed="sidebarPanel === 'search'" :class="{ active: sidebarPanel === 'search' }" @click="showSidebarPanel('search')"><el-icon><Search /></el-icon></button>
        <button type="button" title="标签" aria-label="标签" :aria-pressed="sidebarPanel === 'tags'" :class="{ active: sidebarPanel === 'tags' }" @click="showSidebarPanel('tags')"><el-icon><Tags /></el-icon></button>
        <button type="button" title="收藏" aria-label="收藏" :aria-pressed="sidebarPanel === 'favorites'" :class="{ active: sidebarPanel === 'favorites' }" @click="showSidebarPanel('favorites')"><el-icon><Bookmark /></el-icon></button>
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
          <div v-if="favoriteFolderRows.length" class="np-folder-favorites">
            <div class="np-folder-favorites-heading"><el-icon><Bookmark /></el-icon><span>收藏的文件夹</span></div>
            <button v-for="path in favoriteFolderRows" :key="'favorite:' + path" type="button" class="np-folder-favorite"
              :class="{ active: selectedFolderView === folderViewId(path) }" :title="path" @click="setView(folderViewId(path))"
              @contextmenu.prevent.stop="openTreeContextMenu($event, { kind: 'folder', path })">
              <el-icon><Folder /></el-icon><span>{{ path }}</span>
            </button>
          </div>
          <div class="np-tree-root" :class="{ active: selectedFolderView === folderViewId('') }"
            @contextmenu.prevent.stop="openTreeContextMenu($event, { kind: 'root', path: '' })">
            <button type="button" class="np-tree-chevron np-tree-root-chevron"
              :class="{ expanded: rootHasChildren && isFolderExpanded('') }"
              :aria-label="rootHasChildren ? (isFolderExpanded('') ? '折叠笔记库根目录' : '展开笔记库根目录') : '笔记库根目录为空'"
              :aria-expanded="rootHasChildren ? isFolderExpanded('') : undefined"
              :disabled="!rootHasChildren" @click.stop="toggleFolder('')">
              <el-icon><ChevronRight /></el-icon>
            </button>
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
              { active: row.type === 'folder' ? selectedFolderView === folderViewId(row.path) : !!row.note && isNoteActive(row.note.id) }
            ]"
            @contextmenu.prevent.stop="openTreeContextMenu($event, row.type === 'folder' ? { kind: 'folder', path: row.path } : row.note ? { kind: 'note', path: row.path, note: row.note } : { kind: 'root', path: '' })"
          >
            <button v-if="row.type === 'folder'" type="button" class="np-tree-chevron"
              :class="{ expanded: row.hasChildren && isFolderExpanded(row.path) }" :style="{ marginLeft: 8 + row.depth * 14 + 'px' }"
              :aria-label="row.hasChildren ? ((isFolderExpanded(row.path) ? '折叠 ' : '展开 ') + row.path) : row.path + '（空文件夹）'"
              :aria-expanded="row.hasChildren ? isFolderExpanded(row.path) : undefined"
              :disabled="!row.hasChildren" @click.stop="toggleFolder(row.path)">
              <el-icon><ChevronRight /></el-icon>
            </button>
            <span v-else class="np-tree-chevron-spacer" :style="{ marginLeft: 8 + row.depth * 14 + 'px' }"></span>
            <button type="button" class="np-tree-row" @click="selectTreeRow(row)">
              <el-icon class="np-tree-item-icon"><Folder v-if="row.type === 'folder'" /><FileText v-else /></el-icon>
              <span class="np-tree-label">{{ row.type === 'folder' ? row.name : (row.note?.title || '新笔记') }}</span>
              <el-icon v-if="row.type === 'note' && row.note?.pinned" class="np-tree-pin" title="已收藏"><Bookmark /></el-icon>
            </button>
          </div>
          <div v-if="libraryWritable && !rootHasChildren" class="np-tree-empty">此文件夹还没有笔记或子文件夹</div>
        </nav>
      </section>

      <section v-else-if="sidebarPanel === 'search'" class="np-sidebar-panel np-search-panel">
        <div class="np-sidebar-header"><div class="np-sidebar-heading"><el-icon><Search /></el-icon><span>{{ searchFolderScope === null ? '搜索' : '查找文件夹' }}</span></div></div>
        <div v-if="searchFolderScope !== null" class="np-search-scope">
          <span :title="searchFolderScope || '笔记库根目录'">范围：{{ searchFolderScope || '笔记库根目录' }}</span>
          <button type="button" title="搜索整个笔记库" @click="searchFolderScope = null">清除范围</button>
        </div>
        <div class="np-search">
          <el-icon><Search /></el-icon>
          <input ref="searchInputRef" v-model="query" placeholder="搜索笔记内容" aria-label="搜索笔记内容" />
          <button v-if="query" type="button" title="清除搜索" @click="query = ''"><el-icon><X /></el-icon></button>
        </div>
        <div class="np-search-results" aria-live="polite">
          <button v-for="note in searchResults" :key="note.id" type="button" class="np-search-result"
            :class="{ active: isNoteActive(note.id) }" @click="openNote(note)">
            <el-icon><FileText /></el-icon><span><strong>{{ note.title || '新笔记' }}</strong></span>
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
        <div class="np-tag-tree"><TagTree :active="selectedTagView" :folder-path="currentTagFolderPath" @select="setView" @edit="openEditTag" /></div>
        <div v-if="activeTagIds !== null" class="np-tag-note-list">
          <div class="np-tag-note-list-heading">匹配笔记 <span>{{ activeTagNotes.length }}</span></div>
          <button v-for="note in activeTagNotes" :key="note.id" type="button" class="np-search-result"
            :class="{ active: isNoteActive(note.id) }" @click="openNote(note)">
            <el-icon><FileText /></el-icon><span><strong>{{ note.title || '新笔记' }}</strong></span>
          </button>
          <div v-if="activeTagNotes.length === 0" class="np-tree-empty">这个标签下还没有笔记</div>
        </div>
      </section>

      <section v-else class="np-sidebar-panel np-favorites-panel">
        <div class="np-sidebar-header"><div class="np-sidebar-heading"><el-icon><Bookmark /></el-icon><span>收藏</span><span class="np-count-badge">{{ favoriteNotes.length }}</span></div></div>
        <div v-if="favoriteNotes.length" class="np-search-results">
          <button v-for="note in favoriteNotes" :key="note.id" type="button" class="np-search-result"
            :class="{ active: isNoteActive(note.id) }" @click="openNote(note)">
            <el-icon><Bookmark /></el-icon><span><strong>{{ note.title || '新笔记' }}</strong><small>{{ note.folderPath || '笔记库根目录' }}</small></span>
          </button>
        </div>
        <div v-else class="np-favorites-empty"><el-icon><Bookmark /></el-icon><span>还没有收藏的笔记</span></div>
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
      <div class="np-sidebar-resizer" role="separator" aria-orientation="vertical" tabindex="0"
        aria-label="拖动调整侧栏宽度；拖到左侧可隐藏，隐藏后向右拖动可展开"
        :aria-valuemin="SIDEBAR_RAIL_WIDTH" :aria-valuemax="sidebarMaxWidth"
        :aria-valuenow="sidebarCollapsed ? SIDEBAR_RAIL_WIDTH : sidebarWidth"
        :aria-valuetext="sidebarCollapsed ? '侧栏已隐藏' : '侧栏宽度 ' + sidebarWidth + ' 像素'"
        title="拖动调整侧栏宽度；拖到左侧可隐藏，隐藏后向右拖动可展开"
        @pointerdown.stop.prevent="startSidebarResize" @keydown="onSidebarResizerKeydown" />
    </aside>
    <div v-if="treeContextMenu" class="np-tree-context-menu" role="menu" :style="{ left: treeContextMenu.x + 'px', top: treeContextMenu.y + 'px' }" @click.stop @contextmenu.prevent>
      <template v-if="treeContextMenu.kind === 'root'">
        <button type="button" role="menuitem" @click="runTreeContextAction(createContextNote)"><el-icon><FilePlus /></el-icon><span>新建笔记</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(createContextSubfolder)"><el-icon><FolderPlus /></el-icon><span>新建文件夹</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(findContextFolder)"><el-icon><Search /></el-icon><span>在文件夹中查找</span></button>
        <div class="np-tree-context-submenu" :class="{ open: activeTreeSubmenu === 'root-copy' }">
          <button type="button" role="menuitem" aria-haspopup="menu" :aria-expanded="activeTreeSubmenu === 'root-copy'" @click.stop="toggleTreeSubmenu('root-copy', $event)"><el-icon><Copy /></el-icon><span>复制路径</span><el-icon class="submenu-arrow"><ChevronDown /></el-icon></button>
        </div>
        <div class="np-tree-context-divider"></div>
        <button type="button" role="menuitem" @click="runTreeContextAction(revealContextFolder)"><el-icon><Folder /></el-icon><span>在系统文件资源管理器中打开</span></button>
      </template>
      <template v-else-if="treeContextMenu.kind === 'folder'">
        <button type="button" role="menuitem" @click="runTreeContextAction(createContextNote)"><el-icon><FilePlus /></el-icon><span>新建笔记</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(createContextSubfolder)"><el-icon><FolderPlus /></el-icon><span>新建文件夹</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(duplicateContextFolder)"><el-icon><Copy /></el-icon><span>创建副本</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(moveContextFolder)"><el-icon><Folder /></el-icon><span>将文件夹移动到…</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(findContextFolder)"><el-icon><Search /></el-icon><span>在文件夹中查找</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(toggleContextFolderFavorite)"><el-icon><Bookmark /></el-icon><span>{{ favoriteFolderPaths.includes(treeContextMenu.path) ? '取消收藏' : '收藏' }}</span></button>
        <div class="np-tree-context-submenu" :class="{ open: activeTreeSubmenu === 'folder-copy' }">
          <button type="button" role="menuitem" aria-haspopup="menu" :aria-expanded="activeTreeSubmenu === 'folder-copy'" @click.stop="toggleTreeSubmenu('folder-copy', $event)"><el-icon><Copy /></el-icon><span>复制路径</span><el-icon class="submenu-arrow"><ChevronDown /></el-icon></button>
        </div>
        <div class="np-tree-context-divider"></div>
        <button type="button" role="menuitem" @click="runTreeContextAction(revealContextFolder)"><el-icon><Folder /></el-icon><span>在系统文件资源管理器中打开</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(renameContextFolder)"><el-icon><Pencil /></el-icon><span>重命名</span></button>
        <button type="button" role="menuitem" class="danger" @click="runTreeContextAction(deleteContextFolder)"><el-icon><Trash2 /></el-icon><span>删除文件夹</span></button>
      </template>
      <template v-else-if="treeContextMenu.note">
        <button type="button" role="menuitem" @click="runTreeContextAction(openContextNoteInNewTab)"><el-icon><FilePlus /></el-icon><span>在新标签页中打开</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(openContextNoteInNewGroup)"><el-icon><Columns2 /></el-icon><span>在新标签组中打开</span></button>
        <div class="np-tree-context-divider"></div>
        <button type="button" role="menuitem" @click="runTreeContextAction(duplicateContextNote)"><el-icon><Copy /></el-icon><span>创建副本</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(moveContextNote)"><el-icon><Folder /></el-icon><span>将文件移动到…</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(openMergeDialogForContext)"><el-icon><Files /></el-icon><span>将该笔记合并到…</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(openTagPickerForContext)"><el-icon><Tags /></el-icon><span>添加标签…</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(toggleContextNoteFavorite)"><el-icon><Bookmark /></el-icon><span>{{ treeContextMenu.note.pinned ? '取消收藏' : '收藏' }}</span></button>
        <div class="np-tree-context-divider"></div>
        <div class="np-tree-context-submenu" :class="{ open: activeTreeSubmenu === 'note-copy' }">
          <button type="button" role="menuitem" aria-haspopup="menu" :aria-expanded="activeTreeSubmenu === 'note-copy'" @click.stop="toggleTreeSubmenu('note-copy', $event)"><el-icon><Copy /></el-icon><span>复制路径</span><el-icon class="submenu-arrow"><ChevronDown /></el-icon></button>
        </div>
        <button type="button" role="menuitem" @click="runTreeContextAction(exportContextNotePdf)"><el-icon><FileText /></el-icon><span>导出为 PDF…</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(openContextNoteWithDefaultApp)"><el-icon><FileText /></el-icon><span>使用默认应用打开</span></button>
        <button type="button" role="menuitem" @click="runTreeContextAction(revealContextNote)"><el-icon><Folder /></el-icon><span>在系统文件资源管理器中打开</span></button>
        <div class="np-tree-context-divider"></div>
        <button type="button" role="menuitem" @click="runTreeContextAction(renameContextNote)"><el-icon><Pencil /></el-icon><span>重命名</span></button>
        <button type="button" role="menuitem" class="danger" @click="runTreeContextAction(deleteContextNote)"><el-icon><Trash2 /></el-icon><span>删除</span></button>
      </template>
    </div>

    <div v-if="tabContextMenu" class="np-tree-context-menu np-tab-context-menu" role="menu" :style="{ left: tabContextMenu.x + 'px', top: tabContextMenu.y + 'px' }" @click.stop @contextmenu.prevent>
      <button type="button" role="menuitem" @click="runTabContextAction(toggleContextTabPin)"><el-icon><Bookmark /></el-icon><span>{{ isTabPinned(tabContextMenu.noteId) ? '取消固定标签页' : '固定标签页' }}</span></button>
      <button type="button" role="menuitem" @click="runTabContextAction(closeContextTab)"><el-icon><X /></el-icon><span>关闭标签页</span></button>
      <div class="np-tree-context-submenu" :class="{ open: activeTreeSubmenu === 'tab-groups' }">
        <button type="button" role="menuitem" aria-haspopup="menu" :aria-expanded="activeTreeSubmenu === 'tab-groups'" @click.stop="toggleTreeSubmenu('tab-groups', $event)"><el-icon><Layers /></el-icon><span>将标签页添加到新组</span><el-icon class="submenu-arrow"><ChevronDown /></el-icon></button>
      </div>
      <button v-if="tabContainerForNote(tabContextMenu.noteId)" type="button" role="menuitem" @click="runTabContextAction(() => removeTabFromVisualGroup(tabContextMenu!.noteId))"><el-icon><Columns2 /></el-icon><span>从组中删除</span></button>
      <div class="np-tree-context-divider"></div>
      <button type="button" role="menuitem" @click="runTabContextAction(closeOthersContextTabs)"><el-icon><Files /></el-icon><span>关闭其他标签页</span></button>
      <button type="button" role="menuitem" @click="runTabContextAction(closeAllFromTabMenu)"><el-icon><X /></el-icon><span>全部关闭</span></button>
    </div>

    <Teleport to="body">
      <div v-if="activeTreeSubmenu && submenuPosition" class="np-context-flyout" role="menu"
        :style="{ left: submenuPosition.left + 'px', top: submenuPosition.top + 'px' }" @click.stop @contextmenu.prevent>
        <template v-if="activeTreeSubmenu === 'root-copy' || activeTreeSubmenu === 'folder-copy'">
          <button type="button" role="menuitem" @click="runTreeContextAction(copyContextFolderRelativePath)"><span>笔记库相对路径</span></button>
          <button type="button" role="menuitem" @click="runTreeContextAction(copyContextFolderAbsolutePath)"><span>绝对路径</span></button>
        </template>
        <template v-else-if="activeTreeSubmenu === 'note-copy'">
          <button type="button" role="menuitem" @click="runTreeContextAction(copyContextNoteRelativePath)"><span>笔记库相对路径</span></button>
          <button type="button" role="menuitem" @click="runTreeContextAction(copyContextNoteAbsolutePath)"><span>绝对路径</span></button>
        </template>
        <template v-else-if="activeTreeSubmenu === 'tab-groups' && tabContextMenu">
          <button type="button" role="menuitem" @click="runTabContextAction(moveContextTabToNewGroup)"><span>新建组</span></button>
          <button v-for="container in tabContainersForGroup(tabContextMenu.groupId).filter(item => !item.noteIds.includes(tabContextMenu.noteId))" :key="container.id" type="button" role="menuitem"
            @click="runTabContextAction(() => moveContextTabToVisualGroup(container.id))"><span>{{ container.label }}</span></button>
          <div v-if="noteTabContainers.length === 0" class="np-context-flyout-empty">暂无已有分组</div>
        </template>
      </div>
    </Teleport>

    <BaseDialog :visible="tagPickerOpen" title="添加标签" :width="380" teleport @update:visible="tagPickerOpen = $event">
        <input ref="tagInputRef" v-model="tagQuery" class="np-tag-picker-search" placeholder="筛选标签" aria-label="筛选标签" />
        <div class="np-tag-picker-list">
          <button v-for="tag in selectableNoteTags" :key="tag.id" type="button" :class="{ selected: tagPickerNote?.tagIds.includes(tag.id) }"
            @click="togglePickerTag(tag)"><span class="np-tag-picker-check">{{ tagPickerNote?.tagIds.includes(tag.id) ? '✓' : '' }}</span><span>{{ tag.name }}</span></button>
          <div v-if="selectableNoteTags.length === 0" class="np-tree-empty">没有匹配的标签。</div>
        </div>
        <template #footer>
          <el-button @click="openCreateTagFromPicker">新建标签</el-button>
          <el-button type="primary" @click="tagPickerOpen = false">完成</el-button>
        </template>
    </BaseDialog>

    <main class="np-workspace">
      <div class="np-workspace-content" :class="{ 'is-split-vertical': splitDirection === 'vertical', 'is-split-horizontal': splitDirection === 'horizontal' }">
        <NoteTabGroup v-for="group in tabGroups" :key="group.id" :group="group"
          :ref="component => setGroupRef(group.id, component)"
          :notes="noteStore.notes" :all-notes="noteStore.notes" :tags="noteStore.tags"
          :pinned-ids="[...pinnedTabIds]" :tab-containers="tabContainersForPane(group)" :stacked="tabsStacked" :is-active="activeGroupId === group.id"
          :library-writable="libraryWritable" :source-modes="groupSourceModes"
          @activate="activeGroupId = $event" @select="selectGroupTab" @close="closeGroupTab" @close-start="closeGroupStartTab"
          @new-tab="openStartTab" @tab-contextmenu="openTabContextMenu" @save="handleEditorSave"
          @toggle-favorite="toggleFavoriteForTab" @toggle-source="toggleGroupSourceMode" @export="handleGroupExport"
          @open-wiki-link="openWikiLink" @create-note="createNoteForGroup" @choose-library="chooseNotesLibrary">
          <template v-if="group.id === 'primary'" #toolbar>
          <div class="np-tab-menu-wrap np-group-toolbar-menu" @click.stop>
          <button type="button" class="np-tab-control" title="分屏和堆叠布局" aria-label="分屏和堆叠布局" :aria-expanded="splitMenuOpen" @click="splitMenuOpen = !splitMenuOpen"><el-icon><EllipsisVertical /></el-icon></button>
          <div v-if="splitMenuOpen" class="np-tab-menu np-split-menu" role="menu">
            <button type="button" role="menuitem" :class="{ active: splitDirection === 'vertical' }" @click="setSplitDirection('vertical')"><el-icon><Columns2 /></el-icon><span>左右分屏</span></button>
            <button type="button" role="menuitem" :class="{ active: splitDirection === 'horizontal' }" @click="setSplitDirection('horizontal')"><el-icon><Rows2 /></el-icon><span>上下分屏</span></button>
            <div class="np-tree-context-divider"></div>
            <button type="button" role="menuitem" :class="{ active: tabsStacked }" @click="tabsStacked = !tabsStacked; splitMenuOpen = false"><el-icon><Layers /></el-icon><span>{{ tabsStacked ? '取消堆叠标签页' : '堆叠标签页' }}</span></button>
            <button v-if="tabGroups.length > 1" type="button" role="menuitem" @click="closeAllGroupsExceptPrimary"><el-icon><X /></el-icon><span>退出分屏</span></button>
          </div>
          </div>
          </template>
        </NoteTabGroup>
      </div>
    </main>

    <div v-if="libraryManagerVisible" class="np-library-manager-mask" @click.self="libraryManagerVisible = false">
      <section class="np-library-manager" role="dialog" aria-modal="true" aria-label="管理笔记库">
        <aside class="np-library-manager-list">
          <div v-for="library in libraryInfo?.libraries || []" :key="library.id" class="np-library-manager-row">
            <button type="button" class="np-library-manager-entry"
              :class="{ active: library.id === libraryInfo?.activeLibraryId }" :disabled="!library.rootExists"
              @click="selectLibraryFromMenu(library.id, true)">
              <span><strong>{{ library.name }}</strong><small :title="library.rootPath">{{ library.rootPath }}</small></span>
              <span class="np-library-manager-entry-status">{{ library.rootExists ? (library.id === libraryInfo?.activeLibraryId ? '当前' : '') : '不可用' }}</span>
            </button>
            <button v-if="!library.rootExists" type="button" class="np-library-manager-remove"
              title="从列表移除失效记录" :aria-label="'从列表移除失效笔记库「' + library.name + '」'"
              @click="requestRemoveUnavailableLibrary(library)">
              <el-icon><Trash2 /></el-icon>
            </button>
          </div>
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

    <ConfirmDialog v-model="removeUnavailableLibraryConfirm" title="移除失效笔记库"
      :message="'从管理列表移除「' + (unavailableLibraryToRemove?.name || '失效笔记库') + '」？不会删除磁盘文件。'"
      confirm-text="移除记录" @confirm="confirmRemoveUnavailableLibrary" />
    <ConfirmDialog v-model="showDeleteConfirm" title="永久删除笔记"
      :message="'确定永久删除「' + deletingTitle + '」吗？笔记文件会被直接删除，无法恢复。'"
      confirm-text="永久删除" @confirm="onDeleteConfirmed" />
    <ConfirmDialog v-model="showMergeConfirm" title="确认合并笔记"
      :message="mergeConfirmMessage" confirm-text="合并并永久删除来源笔记" @confirm="mergeNotesConfirmed" />
    <BaseDialog :visible="pdfExportDialogVisible" title="导出为 PDF" :width="440" teleport @update:visible="pdfExportDialogVisible = $event">
      <div class="np-dialog-form np-pdf-export-form">
        <label>纸张大小</label>
        <EsdSelect v-model="pdfSettings.pageSize" :options="pdfPageSizeOptions" />
        <label>页边距</label>
        <EsdSelect v-model="pdfSettings.margin" :options="pdfMarginOptions" />
        <label>缩放比例</label>
        <EsdSelect v-model="pdfSettings.scale" :options="pdfScaleOptions" />
        <label class="np-pdf-checkbox"><input v-model="pdfSettings.landscape" type="checkbox" /><span>横向页面</span></label>
        <label class="np-pdf-checkbox"><input v-model="pdfSettings.includeTitle" type="checkbox" /><span>在导出内容中包含笔记标题</span></label>
      </div>
      <template #footer><el-button :disabled="pdfExportBusy" @click="pdfExportDialogVisible = false">取消</el-button><el-button type="primary" :loading="pdfExportBusy" :disabled="!pdfExportTarget" @click="runPdfExport">导出 PDF</el-button></template>
    </BaseDialog>
    <TagForm :visible="tagFormVisible" :tag="editingTag" @update:visible="tagFormVisible = $event"
      @submit="handleTagFormSubmit" @delete="handleTagDelete" />
    <ConfirmDialog v-model="showTagDeleteConfirm" title="删除标签"
      :message="'确定删除标签「' + deletingTagName + '」吗？笔记会保留，仅移除该标签。'"
      @confirm="onTagDeleteConfirmed" />
    <BaseDialog :visible="folderDialogVisible" :title="folderDialogMode === 'create' ? '新建文件夹' : folderDialogMode === 'rename' ? '重命名文件夹' : folderDialogMode === 'move' ? '移动文件夹' : '创建文件夹副本'" :width="460" teleport @update:visible="folderDialogVisible = $event">
      <form class="np-dialog-form" @submit.prevent="saveFolderDialog">
        <label for="np-folder-name">{{ folderDialogMode === 'move' ? '目标文件夹路径' : '文件夹路径' }}</label>
        <input id="np-folder-name" v-model="folderDraft" maxlength="1024" placeholder="例如：项目/研究" autofocus />
        <p>{{ folderDialogMode === 'move' ? '输入笔记库内的新路径。移动会包含此目录下的所有文件和子目录。' : '使用 / 可一次创建多级文件夹。' }}</p>
      </form>
      <template #footer><el-button @click="folderDialogVisible = false">取消</el-button><el-button type="primary" :disabled="!folderDraft.trim()" @click="saveFolderDialog">保存</el-button></template>
    </BaseDialog>
    <BaseDialog :visible="moveNoteDialogVisible && !!movingNote" title="移动文件" :width="460" teleport @update:visible="moveNoteDialogVisible = $event">
      <form class="np-dialog-form" @submit.prevent="moveNoteToSelectedFolder">
        <label for="np-note-move-folder">目标文件夹</label>
        <EsdSelect id="np-note-move-folder" v-model="moveNoteTargetPath" :options="moveNoteSelectOptions" placeholder="选择目标文件夹" />
        <p>笔记会移动到当前笔记库中的目标目录。</p>
      </form>
      <template #footer><el-button @click="moveNoteDialogVisible = false">取消</el-button><el-button type="primary" :disabled="moveNoteTargetPath === (movingNote?.folderPath || '')" @click="moveNoteToSelectedFolder">移动</el-button></template>
    </BaseDialog>
    <BaseDialog :visible="mergeDialogVisible" title="合并笔记" :width="500" teleport @update:visible="mergeDialogVisible = $event">
      <form class="np-dialog-form" @submit.prevent="askMergeConfirm">
        <label>将「{{ mergeSource?.title || '新笔记' }}」合并到</label>
        <EsdSelect id="np-merge-target" v-model="mergeTargetId" :options="mergeTargetSelectOptions" placeholder="选择目标笔记" searchable />
        <p>来源正文会附加到目标笔记末尾，确认合并后来源笔记将被永久删除。</p>
      </form>
      <template #footer><el-button @click="mergeDialogVisible = false">取消</el-button><el-button type="primary" :disabled="!mergeTargetId" @click="askMergeConfirm">合并</el-button></template>
    </BaseDialog>
    <BaseDialog :visible="noteRenameDialogVisible" title="重命名笔记" :width="460" teleport @update:visible="noteRenameDialogVisible = $event">
      <form class="np-dialog-form" @submit.prevent="saveNoteRename">
        <label for="np-note-title">笔记标题</label>
        <input id="np-note-title" v-model="noteRenameDraft" maxlength="512" placeholder="输入笔记标题" autofocus />
      </form>
      <template #footer><el-button @click="noteRenameDialogVisible = false">取消</el-button><el-button type="primary" :disabled="!noteRenameDraft.trim()" @click="saveNoteRename">保存</el-button></template>
    </BaseDialog>
    <ConfirmDialog v-model="folderDeleteVisible" title="删除文件夹"
      :message="'确定删除空文件夹「' + folderToDelete + '」吗？文件夹中有笔记或子文件夹时无法删除。'"
      @confirm="deleteFolderConfirmed" />
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, inject } from 'vue'
import { ElMessage } from 'element-plus'
import { micromark } from 'micromark'
import { ArrowUpDown, Bookmark, Check, ChevronDown, ChevronRight, Columns2, Copy, EllipsisVertical, FilePlus, FileText, Files, Folder, FolderPlus, Layers, Library, ListTree, Pencil, Plus, Rows2, Search, Settings, Tags, Trash2, X } from '@lucide/vue'
import NoteEditor from './NoteEditor.vue'
import NoteTabGroup, { type NoteTabGroupState, type NoteVisualTabContainer } from './NoteTabGroup.vue'
import TagTree from './TagTree.vue'
import TagForm from './TagForm.vue'
import ConfirmDialog from '../common/overlay/ConfirmDialog.vue'
import BaseDialog from '../ui/BaseDialog.vue'
import EsdSelect from './EsdSelect.vue'
import { useNoteStore, getMdPlainText, type Note, type Tag } from '../../stores/noteStore'
import { createBigramIndex } from '../../utils/bigramSearch'
import { extractWikiLinks } from '../editor/wikiLink'
import { exportNoteMarkdown } from '../../utils/noteExport'
import { exportNoteHtml } from '../../utils/noteExportHtml'
import { comboFromEvent } from '../../stores/shortcutStore'
import { usePageNav, restoreModuleNavPath } from '../../composables/usePageNav'
import { logger } from '../../lib/logger'
import { clearCache } from '../../services/storageService'
import { getMediaAssetUrl, mediaKeyFromReference, readMediaAsset, resetMediaAssetMetadataCache } from '../../services/mediaAssets'
import {
  createNotesFolder, deleteNotesFolder, duplicateNotesFolder, exportNotePdf as saveNotePdf, getNotesLibraryInfo, openNoteLibraryPath,
  getNoteLibraryNotePath, readFavoriteNoteFolderPaths, renameNotesFolder, revealNoteLibraryPath, writeFavoriteNoteFolderPaths,
  readPinnedNoteTabIds, removeUnavailableNotesLibrary, selectNotesLibraryFolder, switchNotesLibrary, writePinnedNoteTabIds,
  type NotesLibraryInfo
} from '../../services/notesLibrary'

const emit = defineEmits<{ (e: 'fullscreen-change', fullscreen: boolean): void }>()
const pageNav = usePageNav()
const noteStore = useNoteStore()
const libraryInfo = ref<NotesLibraryInfo | null>(null)
const libraryMenuOpen = ref(false)
const libraryManagerVisible = ref(false)
const removeUnavailableLibraryConfirm = ref(false)
const unavailableLibraryToRemove = ref<{ id: string; name: string } | null>(null)
const libraryWritable = computed(() => !!libraryInfo.value?.configured && !!libraryInfo.value.rootExists)
const activeLibraryName = computed(() =>
  libraryInfo.value?.libraries.find(item => item.id === libraryInfo.value?.activeLibraryId)?.name || '笔记库'
)
const guideRunning = inject('guideRunning', ref(false))
const navPath = computed(() => pageNav.navPath.value)

const FOLDER_VIEW_PREFIX = 'folder:'
const TAG_PATH_VIEW_PREFIX = 'tagpath:'
type SidebarPanel = 'files' | 'search' | 'tags' | 'favorites'
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
const sidebarPanel = ref<SidebarPanel>('files')
const selectedFolderView = ref(ROOT_VIEW)
const selectedTagView = ref(ROOT_VIEW)
const currentView = computed(() => {
  if (sidebarPanel.value === 'favorites') return 'favorites'
  return sidebarPanel.value === 'tags' ? selectedTagView.value : selectedFolderView.value
})
const navViewForPanel = () => sidebarPanel.value === 'favorites' ? 'favorites'
  : sidebarPanel.value === 'tags' ? selectedTagView.value : selectedFolderView.value
const syncSidebarNavPath = () => {
  const view = navViewForPanel()
  pageNav.setNavPath(selectedId.value ? ['notes', view, selectedId.value] : ['notes', view])
}
const selectedNote = computed<Note | null>(() => {
  const id = navPath.value[2]
  return id ? noteStore.notes.find(note => note.id === id) || null : null
})
const selectedId = computed(() => selectedNote.value?.id || null)
const makeTabGroup = (id: string, label: string): NoteTabGroupState => ({ id, label, tabIds: [], activeId: null, previewId: null, startOpen: false, startActive: false })
const tabGroups = ref<NoteTabGroupState[]>([makeTabGroup('primary', '主组')])
const noteTabContainers = ref<NoteVisualTabContainer[]>([])
const visualGroupSerial = ref(0)
const activeGroupId = ref('primary')
const groupSerial = ref(1)
const groupSourceModes = ref<Record<string, boolean>>({})
const groupRefMap = new Map<string, InstanceType<typeof NoteTabGroup>>()
const setGroupRef = (id: string, value: unknown) => {
  if (value) groupRefMap.set(id, value as InstanceType<typeof NoteTabGroup>)
  else groupRefMap.delete(id)
}
const groupById = (id: string) => tabGroups.value.find(group => group.id === id) || null
const primaryGroup = () => tabGroups.value[0] || null
const secondaryGroup = () => tabGroups.value[1] || null
const openTabIds = computed<string[]>({ get: () => primaryGroup()?.tabIds || [], set: value => { const group = primaryGroup(); if (group) group.tabIds = value } })
const pinnedTabIds = ref<Set<string>>(new Set())
const previewTabId = computed<string | null>({ get: () => primaryGroup()?.previewId || null, set: value => { const group = primaryGroup(); if (group) group.previewId = value } })
const pinnedTabStateReady = ref(false)
let pinnedTabSaveQueue: Promise<void> = Promise.resolve()
const tabMenuOpen = ref(false)
const splitMenuOpen = ref(false)
type TabContextMenuState = { groupId: string; noteId: string; x: number; y: number }
const tabContextMenu = ref<TabContextMenuState | null>(null)
const tabsStacked = ref(false)
const splitDirection = ref<'vertical' | 'horizontal' | null>(null)
const noteForTab = (id: string) => noteStore.notes.find(note => note.id === id) || null
const activeNoteForGroup = () => noteForTab(groupById(activeGroupId.value)?.activeId || '')
const stackSourceMode = (id: string) => !!groupSourceModes.value[id]
const toggleStackSourceMode = (id: string) => { groupSourceModes.value = { ...groupSourceModes.value, [id]: !stackSourceMode(id) } }
const isTabPinned = (id: string) => pinnedTabIds.value.has(id)
const isNoteActive = (id: string) => tabGroups.value.some(group => group.activeId === id)
const groupContainingNote = (id: string) => tabGroups.value.find(group => group.tabIds.includes(id)) || null
const tabContainerForNote = (id: string) => noteTabContainers.value.find(container => container.noteIds.includes(id)) || null
const tabContainersForPane = (group: NoteTabGroupState) => noteTabContainers.value
  .map(container => ({ ...container, noteIds: container.noteIds.filter(id => group.tabIds.includes(id)) }))
  .filter(container => container.noteIds.length > 0)
const tabContainersForGroup = (groupId: string) => {
  const group = groupById(groupId)
  return group ? tabContainersForPane(group) : []
}
const removeTabFromVisualGroups = (noteId: string) => {
  noteTabContainers.value = noteTabContainers.value
    .map(container => ({ ...container, noteIds: container.noteIds.filter(id => id !== noteId) }))
    .filter(container => container.noteIds.length > 0)
}
const addTabToVisualGroup = (noteId: string, containerId: string) => {
  if (!groupContainingNote(noteId)) return
  if (!noteTabContainers.value.some(container => container.id === containerId)) return
  removeTabFromVisualGroups(noteId)
  const target = noteTabContainers.value.find(container => container.id === containerId)
  target?.noteIds.push(noteId)
}
const createVisualTabGroup = (noteId: string) => {
  if (!groupContainingNote(noteId)) return
  removeTabFromVisualGroups(noteId)
  const serial = ++visualGroupSerial.value
  noteTabContainers.value.push({ id: `tab-container-${serial}`, label: `标签组 ${serial}`, noteIds: [noteId] })
}
const setActiveNoteInGroup = (group: NoteTabGroupState, id: string | null) => {
  group.activeId = id
  group.startActive = false
  activeGroupId.value = group.id
  if (group.id === 'primary') {
    const view = navViewForPanel()
    pageNav.setNavPath(id ? ['notes', view, id] : ['notes', view])
  }
}
const persistPinnedTabs = () => {
  const libraryId = libraryInfo.value?.activeLibraryId
  if (!pinnedTabStateReady.value || !libraryId) return
  const ids = [...new Set(tabGroups.value.flatMap(group => group.tabIds))].filter(id => pinnedTabIds.value.has(id))
  const rootPath = libraryInfo.value?.rootPath || undefined
  pinnedTabSaveQueue = pinnedTabSaveQueue.catch(() => undefined).then(async () => {
    try { await writePinnedNoteTabIds(libraryId, ids, rootPath) }
    catch (error) { logger.error('[笔记标签] 保存固定标签状态失败', { error: error instanceof Error ? error.message : String(error) }) }
  })
}
const restorePinnedTabs = async (libraryId: string | null) => {
  pinnedTabStateReady.value = false
  noteTabContainers.value = []
  visualGroupSerial.value = 0
  if (!libraryId) {
    tabGroups.value = [makeTabGroup('primary', '主组')]
    activeGroupId.value = 'primary'
    pinnedTabIds.value = new Set()
    pinnedTabStateReady.value = true
    return
  }
  let savedIds: string[] = []
  try { savedIds = await readPinnedNoteTabIds(libraryId, libraryInfo.value?.rootPath || undefined) }
  catch (error) { logger.error('[笔记标签] 读取固定标签状态失败', { error: error instanceof Error ? error.message : String(error) }) }
  if (libraryInfo.value?.activeLibraryId !== libraryId) return
  const available = new Set(noteStore.notes.map(note => note.id))
  const validIds = [...new Set(savedIds)].filter(id => available.has(id))
  const restored = makeTabGroup('primary', '主组')
  restored.tabIds = validIds
  restored.activeId = validIds[0] || null
  restored.startOpen = validIds.length === 0
  restored.startActive = validIds.length === 0
  tabGroups.value = [restored]
  activeGroupId.value = 'primary'
  pinnedTabIds.value = new Set(validIds)
  pinnedTabStateReady.value = true
  if (validIds.length !== savedIds.length) persistPinnedTabs()
}
const addOrReplacePreviewTab = (id: string, group = primaryGroup(), forceNew = false) => {
  if (!group) return
  if (group.tabIds.includes(id)) { group.previewId = isTabPinned(id) ? null : group.previewId || id; return }
  const previousPreviewId = group.previewId
  const previousPreviewIndex = previousPreviewId ? group.tabIds.indexOf(previousPreviewId) : -1
  if (!forceNew && previousPreviewId && previousPreviewIndex >= 0 && !isTabPinned(previousPreviewId)) group.tabIds.splice(previousPreviewIndex, 1, id)
  else group.tabIds.push(id)
  group.previewId = isTabPinned(id) ? null : id
}
const toggleTabPin = (id: string) => {
  const group = groupContainingNote(id)
  if (!group) return
  const next = new Set(pinnedTabIds.value)
  if (next.has(id)) {
    next.delete(id)
    const existingPreview = group.previewId
    if (existingPreview && existingPreview !== id && group.tabIds.includes(existingPreview)) next.add(existingPreview)
    group.previewId = id
  } else {
    next.add(id)
    if (group.previewId === id) group.previewId = null
  }
  pinnedTabIds.value = next
  persistPinnedTabs()
}
watch(selectedId, id => {
  if (!id) return
  if (!groupContainingNote(id)) {
    const group = primaryGroup()
    if (group) addOrReplacePreviewTab(id, group)
  }
  const group = groupContainingNote(id) || primaryGroup()
  if (group) setActiveNoteInGroup(group, id)
})
watch(() => noteStore.notes.map(note => note.id).join('|'), () => {
  const available = new Set(noteStore.notes.map(note => note.id))
  noteTabContainers.value = noteTabContainers.value
    .map(container => ({ ...container, noteIds: container.noteIds.filter(id => available.has(id)) }))
    .filter(container => container.noteIds.length > 0)
  const activeBefore = tabGroups.value.map(group => [group.id, group.activeId] as const)
  for (const group of tabGroups.value) {
    group.tabIds = group.tabIds.filter(id => available.has(id))
    if (group.previewId && !available.has(group.previewId)) group.previewId = null
    if (group.activeId && !available.has(group.activeId)) group.activeId = group.tabIds.at(-1) || null
    if (!group.activeId && group.startOpen) group.startActive = true
    if (group.id === 'primary' && activeBefore.some(([id, previous]) => id === 'primary' && !!previous)
      && !group.tabIds.length && !group.startOpen) {
      group.startOpen = true
      group.startActive = true
    }
  }
  const previousPinnedIds = [...pinnedTabIds.value]
  const nextPinnedIds = previousPinnedIds.filter(id => available.has(id))
  pinnedTabIds.value = new Set(nextPinnedIds)
  tabGroups.value = tabGroups.value.filter((group, index) => index === 0 || group.tabIds.length || group.startOpen)
  if (!groupById(activeGroupId.value)) activeGroupId.value = 'primary'
  if (tabGroups.value.length === 1) splitDirection.value = null
  for (const [groupId, previousId] of activeBefore) {
    const group = groupById(groupId)
    if (group && previousId && !group.activeId && group.id === 'primary') pageNav.setNavPath(['notes', navViewForPanel()])
  }
  if (nextPinnedIds.length !== previousPinnedIds.length) persistPinnedTabs()
})
const openStartTab = (requestedGroupId?: string) => {
  const group = groupById(requestedGroupId || activeGroupId.value) || primaryGroup()
  if (!group) return
  activeGroupId.value = group.id
  group.startOpen = true
  group.startActive = true
  group.activeId = null
  tabMenuOpen.value = false
  splitMenuOpen.value = false
  if (group.id === 'primary') pageNav.setNavPath(['notes', navViewForPanel()])
}
const closeGroupStartTab = (groupId: string) => {
  const group = groupById(groupId)
  if (!group) return
  group.startOpen = false
  if (!group.startActive) return
  group.startActive = false
  const fallback = group.tabIds.at(-1)
  if (fallback) selectGroupTab(group.id, fallback)
  else if (group.id !== 'primary') {
    tabGroups.value = tabGroups.value.filter(item => item.id !== group.id)
    if (tabGroups.value.length === 1) splitDirection.value = null
    if (activeGroupId.value === group.id) activeGroupId.value = 'primary'
  }
  else if (group.id === 'primary' && group.tabIds.length === 0) {
    group.startOpen = true
    group.startActive = true
    pageNav.setNavPath(['notes', navViewForPanel()])
  } else pageNav.setNavPath(['notes', navViewForPanel()])
}
const removePinIfNoOpenTab = (id: string) => {
  if (groupContainingNote(id) || !pinnedTabIds.value.has(id)) return
  const next = new Set(pinnedTabIds.value)
  next.delete(id)
  pinnedTabIds.value = next
  persistPinnedTabs()
}
const closeGroupTab = (groupId: string, id: string) => {
  const group = groupById(groupId)
  if (!group) return
  const index = group.tabIds.indexOf(id)
  if (index < 0) return
  const wasActive = group.activeId === id
  group.tabIds.splice(index, 1)
  if (!groupContainingNote(id)) removeTabFromVisualGroups(id)
  if (group.previewId === id) group.previewId = null
  removePinIfNoOpenTab(id)
  if (wasActive) {
    const fallback = group.tabIds[index] || group.tabIds[index - 1] || null
    if (fallback) setActiveNoteInGroup(group, fallback)
    else {
      group.activeId = null
      group.startActive = false
      if (group.id === 'primary') {
        group.startOpen = true
        group.startActive = true
        pageNav.setNavPath(['notes', navViewForPanel()])
      }
    }
  }
  if (group.id !== 'primary' && group.tabIds.length === 0 && !group.startOpen) {
    tabGroups.value = tabGroups.value.filter(item => item.id !== group.id)
    if (activeGroupId.value === group.id) activeGroupId.value = 'primary'
    if (splitDirection.value && tabGroups.value.length === 1) splitDirection.value = null
  }
}
const closeAllTabs = () => {
  const primary = makeTabGroup('primary', '主组')
  primary.startOpen = true
  primary.startActive = true
  tabGroups.value = [primary]
  noteTabContainers.value = []
  pinnedTabIds.value = new Set()
  persistPinnedTabs()
  splitDirection.value = null
  activeGroupId.value = 'primary'
  tabMenuOpen.value = false
  pageNav.setNavPath(['notes', navViewForPanel()])
}
const setSplitDirection = (direction: 'vertical' | 'horizontal') => {
  splitDirection.value = direction
  splitMenuOpen.value = false
  if (tabGroups.value.length === 1) {
    const group = makeTabGroup('group-' + (++groupSerial.value), '分屏 ' + (tabGroups.value.length + 1))
    group.startOpen = true
    group.startActive = true
    tabGroups.value.push(group)
  }
  activeGroupId.value = tabGroups.value.at(-1)?.id || 'primary'
}
const SIDEBAR_RAIL_WIDTH = 0
const SIDEBAR_COLLAPSE_THRESHOLD = 64
const sidebarViewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)
const getSidebarMinimumWidth = (viewportWidth = sidebarViewportWidth.value) => viewportWidth <= 620 ? 140 : 168
const getSidebarMaximumWidth = (viewportWidth = sidebarViewportWidth.value) => Math.max(
  getSidebarMinimumWidth(viewportWidth),
  Math.round(Math.min(viewportWidth <= 620 ? 210 : 480, viewportWidth * 0.48)),
)
const getInitialSidebarWidth = (viewportWidth: number) => {
  if (viewportWidth <= 620) return Math.round(Math.max(140, Math.min(210, viewportWidth * 0.38)))
  if (viewportWidth <= 1099) return Math.round(Math.max(168, Math.min(268, viewportWidth * 0.25)))
  return 268
}
const sidebarMinWidth = computed(() => getSidebarMinimumWidth())
const sidebarMaxWidth = computed(() => getSidebarMaximumWidth())
const sidebarWidth = ref(getInitialSidebarWidth(sidebarViewportWidth.value))
const sidebarCollapsed = ref(false)
const sidebarResizing = ref(false)
let sidebarResizeStartX = 0
let sidebarResizeStartWidth = 0
let sidebarResizeStartedCollapsed = false
let sidebarResizeHandle: HTMLElement | null = null
let sidebarResizePointerId: number | null = null
const clampSidebarWidth = (width: number) => Math.round(Math.max(sidebarMinWidth.value, Math.min(sidebarMaxWidth.value, width)))
const onSidebarResizeMove = (event: PointerEvent) => {
  if (!sidebarResizing.value) return
  const requestedWidth = sidebarResizeStartWidth + event.clientX - sidebarResizeStartX
  if (sidebarResizeStartedCollapsed ? requestedWidth < sidebarMinWidth.value : requestedWidth <= SIDEBAR_COLLAPSE_THRESHOLD) {
    sidebarCollapsed.value = true
    return
  }
  sidebarCollapsed.value = false
  sidebarWidth.value = clampSidebarWidth(requestedWidth)
}
const stopSidebarResize = () => {
  sidebarResizing.value = false
  document.removeEventListener('pointermove', onSidebarResizeMove)
  document.removeEventListener('pointerup', stopSidebarResize)
  document.removeEventListener('pointercancel', stopSidebarResize)
  window.removeEventListener('blur', stopSidebarResize)
  if (sidebarResizeHandle && sidebarResizePointerId !== null && sidebarResizeHandle.hasPointerCapture(sidebarResizePointerId)) {
    sidebarResizeHandle.releasePointerCapture(sidebarResizePointerId)
  }
  sidebarResizeHandle = null
  sidebarResizePointerId = null
  document.documentElement.classList.remove('np-sidebar-resizing')
}
const startSidebarResize = (event: PointerEvent) => {
  if (event.button !== 0) return
  sidebarResizing.value = true
  sidebarResizeHandle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  sidebarResizePointerId = event.pointerId
  sidebarResizeHandle?.setPointerCapture(event.pointerId)
  sidebarResizeStartX = event.clientX
  sidebarResizeStartedCollapsed = sidebarCollapsed.value
  sidebarResizeStartWidth = sidebarCollapsed.value ? 0 : sidebarWidth.value
  document.documentElement.classList.add('np-sidebar-resizing')
  document.addEventListener('pointermove', onSidebarResizeMove)
  document.addEventListener('pointerup', stopSidebarResize)
  document.addEventListener('pointercancel', stopSidebarResize)
  window.addEventListener('blur', stopSidebarResize)
}
const onSidebarResizerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Home') {
    event.preventDefault()
    sidebarCollapsed.value = true
  } else if (event.key === 'End') {
    event.preventDefault()
    sidebarCollapsed.value = false
    sidebarWidth.value = sidebarMaxWidth.value
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    if (sidebarCollapsed.value) {
      sidebarCollapsed.value = false
      sidebarWidth.value = sidebarMinWidth.value
    } else sidebarWidth.value = clampSidebarWidth(sidebarWidth.value + 24)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (sidebarCollapsed.value || sidebarWidth.value <= sidebarMinWidth.value) sidebarCollapsed.value = true
    else sidebarWidth.value = clampSidebarWidth(sidebarWidth.value - 24)
  }
}
const onSidebarWindowResize = () => {
  sidebarViewportWidth.value = window.innerWidth
  if (!sidebarCollapsed.value) sidebarWidth.value = clampSidebarWidth(sidebarWidth.value)
}
const query = ref('')
const searchFolderScope = ref<string | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
type NoteSort = 'name-asc' | 'name-desc' | 'edited-desc' | 'edited-asc' | 'created-desc' | 'created-asc'
const noteSort = ref<NoteSort>('name-asc')
const sortMenuOpen = ref(false)
type TreeContextMenuState = { kind: 'root' | 'folder' | 'note'; path: string; note: Note | null; x: number; y: number }
const treeContextMenu = ref<TreeContextMenuState | null>(null)
const activeTreeSubmenu = ref<string | null>(null)
const submenuPosition = ref<{ left: number; top: number } | null>(null)
const openTreeContextMenu = (event: MouseEvent, target: { kind: 'root' | 'folder' | 'note'; path: string; note?: Note }) => {
  const menuHeight = target.kind === 'note' ? 560 : target.kind === 'folder' ? 410 : 250
  activeTreeSubmenu.value = null
  submenuPosition.value = null
  treeContextMenu.value = {
    kind: target.kind,
    path: target.path,
    note: target.note || null,
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 304)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
  }
}
const closeTreeContextMenu = () => { treeContextMenu.value = null; activeTreeSubmenu.value = null; submenuPosition.value = null }
const toggleTreeSubmenu = (key: string, event: MouseEvent) => {
  if (activeTreeSubmenu.value === key) {
    activeTreeSubmenu.value = null
    submenuPosition.value = null
    return
  }
  const anchor = event.currentTarget as HTMLElement | null
  if (!anchor) return
  const rect = anchor.getBoundingClientRect()
  const width = 224
  const itemCount = key === 'tab-groups' ? tabContainersForGroup(tabContextMenu.value?.groupId || '').length + 1 : 2
  const estimatedHeight = Math.min(360, itemCount * 36 + 12)
  const left = rect.right + width + 8 <= window.innerWidth ? rect.right + 4 : Math.max(8, rect.left - width - 4)
  const top = Math.max(8, Math.min(rect.top, window.innerHeight - estimatedHeight - 8))
  activeTreeSubmenu.value = key
  submenuPosition.value = { left, top }
}
const runTreeContextAction = (action: () => unknown) => {
  let result: unknown
  try { result = action() }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '操作失败') }
  closeTreeContextMenu()
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    void (result as Promise<unknown>).catch(error => ElMessage.error(error instanceof Error ? error.message : '操作失败'))
  }
}
const contextNote = () => treeContextMenu.value?.note || null
const contextPath = () => treeContextMenu.value?.path || ''
const createContextNote = () => createNoteAtFolder(contextPath())
const createContextSubfolder = () => openFolderDialog('create', contextPath())
const findContextFolder = () => findFolder(contextPath())
const copyContextFolderRelativePath = () => copyFolderPath(contextPath(), 'relative')
const copyContextFolderAbsolutePath = () => copyFolderPath(contextPath(), 'absolute')
const renameContextFolder = () => openFolderDialog('rename', contextPath())
const duplicateContextFolder = () => openFolderDialog('duplicate', contextPath())
const moveContextFolder = () => openFolderDialog('move', contextPath())
const toggleContextFolderFavorite = () => toggleFolderFavorite(contextPath())
const revealContextFolder = () => revealFolderInLibrary(contextPath())
const deleteContextFolder = () => askDeleteFolder(contextPath())
const openContextNoteInNewTab = () => { const note = contextNote(); if (note) openNoteInNewTab(note) }
const openContextNoteInNewGroup = () => { const note = contextNote(); if (note) openNoteInNewGroup(note) }
const duplicateContextNote = () => { const note = contextNote(); if (note) void duplicateNote(note) }
const moveContextNote = () => { const note = contextNote(); if (note) openMoveNoteDialog(note) }
const openMergeDialogForContext = () => { const note = contextNote(); if (note) openMergeDialog(note) }
const openTagPickerForContext = () => { const note = contextNote(); if (note) openTagPicker(note) }
const toggleContextNoteFavorite = () => { const note = contextNote(); if (note) void toggleNoteFavorite(note) }
const openContextNoteWithDefaultApp = () => { const note = contextNote(); return note ? openNoteWithDefaultApp(note) : undefined }
const revealContextNote = () => { const note = contextNote(); return note ? revealNoteInLibrary(note) : undefined }
const exportContextNotePdf = () => { const note = contextNote(); if (note) exportNotePdf(note) }
const copyContextNoteRelativePath = () => { const note = contextNote(); if (note) void copyNotePath(note, 'relative') }
const copyContextNoteAbsolutePath = () => { const note = contextNote(); if (note) void copyNotePath(note, 'absolute') }
const renameContextNote = () => { const note = contextNote(); if (note) openNoteRenameDialog(note) }
const deleteContextNote = () => { const note = contextNote(); if (note) askDeleteNote(note) }
const runTabContextAction = (action: () => unknown) => {
  const result = action()
  tabContextMenu.value = null
  tabMenuOpen.value = false
  activeTreeSubmenu.value = null
  submenuPosition.value = null
  void result
}
const toggleContextTabPin = () => { const context = tabContextMenu.value; if (context) toggleTabPin(context.noteId) }
const closeContextTab = () => { const context = tabContextMenu.value; if (context) closeGroupTab(context.groupId, context.noteId) }
const moveContextTabToNewGroup = () => { const context = tabContextMenu.value; if (context) moveTabToNewGroup(context.groupId, context.noteId) }
const moveContextTabToGroup = (targetGroupId: string) => {
  const context = tabContextMenu.value
  if (context) moveTabToGroup(context.noteId, context.groupId, targetGroupId)
}
const closeOthersContextTabs = () => { const context = tabContextMenu.value; if (context) closeOthersTabs(context.groupId, context.noteId) }
const noteSortOptions: Array<{ value: NoteSort; label: string }> = [
  { value: 'name-asc', label: '文件名 (A-Z)' },
  { value: 'name-desc', label: '文件名 (Z-A)' },
  { value: 'edited-desc', label: '编辑时间（从新到旧）' },
  { value: 'edited-asc', label: '编辑时间（从旧到新）' },
  { value: 'created-desc', label: '创建时间（从新到旧）' },
  { value: 'created-asc', label: '创建时间（从旧到新）' },
]
const expandedFolders = ref<Set<string>>(new Set())
const folderRows = computed(() => [...(libraryInfo.value?.folders || [])]
  .map(path => ({ path, name: path.split('/').at(-1) || path }))
  .sort((a, b) => a.path.localeCompare(b.path, 'zh')))
const favoriteFolderPaths = ref<string[]>([])
const favoriteFolderRows = computed(() => favoriteFolderPaths.value.filter(path => folderRows.value.some(folder => folder.path === path)))
let folderFavoritesSaveQueue: Promise<void> = Promise.resolve()
const loadFolderFavorites = async () => {
  const libraryId = libraryInfo.value?.activeLibraryId
  if (!libraryId) { favoriteFolderPaths.value = []; return }
  try {
    const paths = await readFavoriteNoteFolderPaths(libraryId, libraryInfo.value?.rootPath || undefined)
    if (libraryInfo.value?.activeLibraryId === libraryId) favoriteFolderPaths.value = paths
  } catch (error) {
    logger.error('[笔记库] 读取文件夹收藏失败', { error: error instanceof Error ? error.message : String(error) })
    favoriteFolderPaths.value = []
  }
}
const persistFolderFavorites = () => {
  const libraryId = libraryInfo.value?.activeLibraryId
  const rootPath = libraryInfo.value?.rootPath || undefined
  const paths = [...favoriteFolderPaths.value]
  if (!libraryId) return
  folderFavoritesSaveQueue = folderFavoritesSaveQueue.catch(() => undefined).then(async () => {
    try { await writeFavoriteNoteFolderPaths(libraryId, paths, rootPath) }
    catch (error) { logger.error('[笔记库] 保存文件夹收藏失败', { error: error instanceof Error ? error.message : String(error) }) }
  })
}
const toggleFolderFavorite = (path: string) => {
  if (!path || !libraryWritable.value) return
  favoriteFolderPaths.value = favoriteFolderPaths.value.includes(path)
    ? favoriteFolderPaths.value.filter(item => item !== path)
    : [...favoriteFolderPaths.value, path]
  persistFolderFavorites()
}
const folderTreeSignature = computed(() => JSON.stringify({
  libraryId: libraryInfo.value?.activeLibraryId || '',
  paths: folderRows.value.map(({ path }) => path),
}))
watch(folderTreeSignature, (signature, previousSignature) => {
  const current = JSON.parse(signature) as { libraryId: string; paths: string[] }
  const previous = previousSignature
    ? JSON.parse(previousSignature) as { libraryId: string; paths: string[] }
    : null
  if (!previous || current.libraryId !== previous.libraryId) {
    expandedFolders.value = new Set(['', ...current.paths])
    return
  }

  const validPaths = new Set(['', ...current.paths])
  const next = new Set([...expandedFolders.value].filter(path => validPaths.has(path)))
  expandedFolders.value = next
}, { immediate: true })
const isFolderExpanded = (path: string) => expandedFolders.value.has(path)
const rootHasChildren = computed(() => folderRows.value.some(({ path }) => !path.includes('/'))
  || noteStore.notes.some(note => !note.folderPath))
const allFoldersExpanded = computed(() => folderRows.value.length > 0 && isFolderExpanded('')
  && folderRows.value.every(({ path }) => expandedFolders.value.has(path)))
const toggleAllFolders = () => {
  expandedFolders.value = allFoldersExpanded.value
    ? new Set([''])
    : new Set(['', ...folderRows.value.map(({ path }) => path)])
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
const isTagView = (view: string) => isTagPathView(view) || view.startsWith('v:')
  || noteStore.tags.some(tag => tag.id === view)
const currentTagFolderPath = computed(() => {
  const view = selectedTagView.value
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
  const scope = tagScopeForView(selectedTagView.value)
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
  + '|' + noteStore.tags.map(tag => tag.id + ':' + tag.name + ':' + tag.folderPath).join('|')
)
watch(searchVersion, () => {
  searchIndex.reset()
  for (const note of noteStore.notes) searchIndex.setDoc(note.id, searchableText(note))
}, { immediate: true })
const searchResults = computed(() => {
  const search = query.value.trim()
  if (!search) return []
  void searchVersion.value
  const hits = new Set(searchIndex.search(search))
  return noteStore.notes.filter(note => hits.has(note.id)
    && (searchFolderScope.value === null || !searchFolderScope.value || note.folderPath === searchFolderScope.value
      || note.folderPath.startsWith(searchFolderScope.value + '/')))
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
  if (!isFolderExpanded('')) return rows
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
const favoriteNotes = computed(() => noteStore.notes.filter(note => note.pinned)
  .sort((a, b) => a.title.localeCompare(b.title, 'zh')))
const setView = (view: string) => {
  if (view === 'favorites') {
    showSidebarPanel('favorites')
    return
  }
  let target = view === 'all' ? ROOT_VIEW : view
  if (target === 'trash') target = ROOT_VIEW
  const targetIsTag = isTagView(target)
  const nextPanel = targetIsTag ? 'tags' : 'files'
  const selectedView = targetIsTag ? selectedTagView : selectedFolderView
  const changed = selectedView.value !== target || sidebarPanel.value !== nextPanel
  selectedView.value = target
  sidebarPanel.value = nextPanel
  if (!changed && navPath.value[1] === target && (navPath.value[2] || '') === (selectedId.value || '')) return
  syncSidebarNavPath()
}
const showSidebarPanel = (panel: SidebarPanel) => {
  if (panel === 'search' && sidebarPanel.value !== 'search') searchFolderScope.value = null
  sidebarPanel.value = panel
  syncSidebarNavPath()
  if (panel === 'search') nextTick(() => searchInputRef.value?.focus())
}
const selectGroupTab = (groupId: string, tabId: string | 'start') => {
  const group = groupById(groupId)
  if (!group) return
  activeGroupId.value = groupId
  if (tabId === 'start') {
    group.startOpen = true
    group.startActive = true
    group.activeId = null
    if (group.id === 'primary') pageNav.setNavPath(['notes', navViewForPanel()])
    return
  }
  const note = noteForTab(tabId)
  if (!note || !group.tabIds.includes(tabId)) return
  setActiveNoteInGroup(group, tabId)
}
const createTabGroup = (withWelcome = true) => {
  if (!splitDirection.value) splitDirection.value = 'vertical'
  const group = makeTabGroup('group-' + (++groupSerial.value), '标签组 ' + (tabGroups.value.length + 1))
  group.startOpen = withWelcome
  group.startActive = withWelcome
  tabGroups.value.push(group)
  activeGroupId.value = group.id
  return group
}
const moveTabToGroup = (noteId: string, fromGroupId: string, toGroupId: string) => {
  const source = groupById(fromGroupId) || groupContainingNote(noteId)
  const target = groupById(toGroupId)
  if (!source || !target || source === target || !source.tabIds.includes(noteId)) {
    if (target?.tabIds.includes(noteId)) selectGroupTab(target.id, noteId)
    return
  }
  const sourceIndex = source.tabIds.indexOf(noteId)
  source.tabIds.splice(sourceIndex, 1)
  if (source.previewId === noteId) source.previewId = null
  if (source.activeId === noteId) source.activeId = source.tabIds[sourceIndex] || source.tabIds[sourceIndex - 1] || null
  const replacedPreview = target.previewId
  target.tabIds.push(noteId)
  target.startOpen = false
  target.startActive = false
  target.previewId = isTabPinned(noteId) ? null : noteId
  target.activeId = noteId
  activeGroupId.value = target.id
  if (replacedPreview && replacedPreview !== noteId && !isTabPinned(replacedPreview)) {
    const replacedIndex = target.tabIds.indexOf(replacedPreview)
    if (replacedIndex >= 0) target.tabIds.splice(replacedIndex, 1)
  }
  if (source.id === 'primary') pageNav.setNavPath(['notes', navViewForPanel(), source.activeId || undefined].filter((part): part is string => !!part))
  if (target.id === 'primary') pageNav.setNavPath(['notes', navViewForPanel(), noteId])
  if (source.id !== 'primary' && source.tabIds.length === 0 && !source.startOpen) {
    tabGroups.value = tabGroups.value.filter(group => group.id !== source.id)
    if (splitDirection.value && tabGroups.value.length < 2) splitDirection.value = null
  }
  removePinIfNoOpenTab(replacedPreview || '')
}
const moveTabToNewGroup = (groupId: string, noteId: string) => {
  const source = groupById(groupId)
  if (!source) return
  if (!source.tabIds.includes(noteId)) selectGroupTab(groupId, noteId)
  createVisualTabGroup(noteId)
  tabMenuOpen.value = false
}
const moveTabToVisualGroup = (containerId: string) => {
  const context = tabContextMenu.value
  if (context) addTabToVisualGroup(context.noteId, containerId)
}
const removeTabFromVisualGroup = (noteId: string) => removeTabFromVisualGroups(noteId)
const openNote = (input: Note | string, requestedGroup?: string) => {
  const note = typeof input === 'string' ? noteStore.notes.find(item => item.id === input) : input
  if (!note) return
  const groupId = requestedGroup === 'primary' ? 'primary'
    : requestedGroup === 'secondary' ? (secondaryGroup()?.id || createTabGroup().id)
      : requestedGroup || activeGroupId.value
  const target = groupById(groupId) || primaryGroup()
  if (!target) return
  const owner = groupContainingNote(note.id)
  if (owner && owner.id !== target.id) {
    setActiveNoteInGroup(owner, note.id)
  } else {
    if (!owner) addOrReplacePreviewTab(note.id, target)
    target.startOpen = false
    target.startActive = false
    setActiveNoteInGroup(target, note.id)
  }
  tabMenuOpen.value = false
  splitMenuOpen.value = false
}
const openNoteInNewTab = (note: Note) => {
  const owner = groupContainingNote(note.id)
  if (owner) { setActiveNoteInGroup(owner, note.id); return }
  const group = groupById(activeGroupId.value) || primaryGroup()
  if (!group) return
  if (group.previewId && !isTabPinned(group.previewId)) {
    pinnedTabIds.value = new Set([...pinnedTabIds.value, group.previewId])
    group.previewId = null
    persistPinnedTabs()
  }
  addOrReplacePreviewTab(note.id, group, true)
  group.startOpen = false
  group.startActive = false
  setActiveNoteInGroup(group, note.id)
}
const openNoteInNewGroup = (note: Note) => {
  openNote(note)
  createVisualTabGroup(note.id)
}
const closeAllGroupsExceptPrimary = () => {
  const primary = primaryGroup()
  if (!primary) return
  const activeGroup = groupById(activeGroupId.value)
  const nextPinned = new Set(pinnedTabIds.value)
  for (const group of tabGroups.value.slice(1)) {
    for (const id of group.tabIds) if (!primary.tabIds.includes(id)) primary.tabIds.push(id)
    if (group.id === activeGroup?.id) {
      primary.activeId = group.activeId
      primary.startActive = group.startActive
    }
    if (group.startOpen) primary.startOpen = true
    if (group.previewId && group.tabIds.includes(group.previewId)) {
      if (!primary.previewId) primary.previewId = group.previewId
      else if (primary.previewId !== group.previewId) nextPinned.add(group.previewId)
    }
  }
  pinnedTabIds.value = nextPinned
  tabGroups.value = [primary]
  splitDirection.value = null
  activeGroupId.value = 'primary'
  if (primary.activeId) pageNav.setNavPath(['notes', navViewForPanel(), primary.activeId])
  else pageNav.setNavPath(['notes', navViewForPanel()])
  persistPinnedTabs()
  splitMenuOpen.value = false
}
const closeOthersTabs = (groupId: string, noteId: string) => {
  const note = noteForTab(noteId)
  if (!note) return
  const owner = groupContainingNote(noteId) || groupById(groupId)
  const pinned = pinnedTabIds.value.has(noteId) ? new Set([noteId]) : new Set<string>()
  const primary = primaryGroup() || makeTabGroup('primary', '主组')
  primary.tabIds = [noteId]
  primary.activeId = noteId
  primary.previewId = pinned.has(noteId) ? null : noteId
  primary.startOpen = false
  primary.startActive = false
  tabGroups.value = [primary]
  noteTabContainers.value = noteTabContainers.value
    .map(container => ({ ...container, noteIds: container.noteIds.filter(id => id === noteId) }))
    .filter(container => container.noteIds.length > 0)
  pinnedTabIds.value = pinned
  activeGroupId.value = 'primary'
  splitDirection.value = null
  persistPinnedTabs()
  pageNav.setNavPath(['notes', navViewForPanel(), noteId])
  tabMenuOpen.value = false
  void owner
}
const closeAllFromTabMenu = () => closeAllTabs()
const toggleGroupSourceMode = (noteId: string) => toggleStackSourceMode(noteId)
const handleGroupExport = async (id: string, command: string | number | object, editor: InstanceType<typeof NoteEditor> | null, root: ParentNode) => {
  const note = noteForTab(id)
  if (!note) return
  const tags = note.tagIds.map(tagId => noteStore.tags.find(tag => tag.id === tagId)).filter((tag): tag is Tag => !!tag)
  if (command === 'md') { exportNoteMarkdown(note, tags); ElMessage.success('Markdown 已导出') }
  else if (command === 'html') await exportSelectedNoteHtml(note, editor, root, tags)
}
const createNoteForGroup = async (groupId: string) => {
  const context = noteContextForView(currentView.value)
  const note = await noteStore.addNote({ title: '新笔记', content: '', tagIds: context.tagIds, folderPath: context.folderPath, pinned: false })
  if (note) openNote(note, groupId)
}
const openTabContextMenu = (event: MouseEvent, groupId: string, noteId: string) => {
  const height = 360
  tabMenuOpen.value = true
  activeTreeSubmenu.value = null
  tabContextMenu.value = {
    groupId, noteId,
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 278)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
  }
}
const selectTreeRow = (row: TreeRow) => row.type === 'folder' ? setView(folderViewId(row.path)) : row.note && openNote(row.note)
watch(navPath, () => {
  const path = pageNav.navPath.value
  if (path[0] !== 'notes') return
  if (path.length >= 3 && !noteStore.notes.some(note => note.id === path[2])) {
    const missingId = path[2]
    const owner = groupContainingNote(missingId)
    if (owner) closeGroupTab(owner.id, missingId)
    else pageNav.setNavPath(['notes', navViewForPanel()])
    return
  }
})
const tagPickerOpen = ref(false)
const tagQuery = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)
const tagPickerTargetId = ref<string | null>(null)
const tagPickerNote = computed(() => tagPickerTargetId.value ? noteForTab(tagPickerTargetId.value) : null)
const selectableNoteTags = computed(() => {
  const note = tagPickerNote.value
  if (!note) return []
  const queryText = tagQuery.value.trim().replace(/^#/, '').toLocaleLowerCase()
  return noteStore.tags.filter(tag => tag.folderPath === (note.folderPath || '')
    && (!queryText || tag.name.toLocaleLowerCase().includes(queryText)))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
})
const openTagPicker = (target: Note | string | null = activeNoteForGroup()) => {
  const id = typeof target === 'string' ? target : target?.id || null
  if (!id) { ElMessage.info('先打开一篇笔记'); return }
  tagPickerTargetId.value = id
  tagPickerOpen.value = true
  tagQuery.value = ''
  nextTick(() => tagInputRef.value?.focus())
}
const tagFormFolderPath = ref<string | null>(null)
const tagPickerAddCreated = ref(false)
const openCreateTagFromPicker = () => {
  const note = tagPickerNote.value
  if (!note) return
  tagPickerAddCreated.value = true
  tagFormFolderPath.value = note.folderPath || ''
  tagPickerOpen.value = false
  editingTag.value = null
  tagFormVisible.value = true
}
const togglePickerTag = async (tag: Tag) => {
  const note = tagPickerNote.value
  if (!note) return
  const tagIds = note.tagIds.includes(tag.id) ? note.tagIds.filter(id => id !== tag.id) : [...note.tagIds, tag.id]
  if (!await noteStore.updateNote(note.id, { tagIds })) ElMessage.error('更新笔记标签失败')
}
const tagFormVisible = ref(false)
const editingTag = ref<Tag | null>(null)
const openCreateTag = () => { editingTag.value = null; tagFormFolderPath.value = currentTagFolderPath.value; tagPickerAddCreated.value = false; tagFormVisible.value = true }
const openEditTag = (tag: Tag) => { editingTag.value = tag; tagFormFolderPath.value = null; tagPickerAddCreated.value = false; tagFormVisible.value = true }
const handleTagFormSubmit = async (data: { id?: string; name: string; color: string }) => {
  if (data.id) {
    if (!await noteStore.updateTag(data.id, { name: data.name, color: data.color })) {
      ElMessage.error('保存失败：标签名称与其他标签冲突')
      return
    }
    ElMessage.success('标签已保存')
  } else {
    const tag = await noteStore.addTag({ name: data.name, color: data.color, folderPath: tagFormFolderPath.value ?? currentTagFolderPath.value })
    if (!tag) { ElMessage.error('创建标签失败'); return }
    if (tagPickerAddCreated.value && tagPickerNote.value && !tagPickerNote.value.tagIds.includes(tag.id)) {
      const note = tagPickerNote.value
      if (!await noteStore.updateNote(note.id, { tagIds: [...note.tagIds, tag.id] })) ElMessage.error('标签已创建，但关联到笔记失败')
    }
    ElMessage.success('标签已创建')
  }
  tagPickerAddCreated.value = false
  tagFormFolderPath.value = null
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
    if (selectedTagView.value === tag.id || selectedTagView.value === tagPathViewId(tag.folderPath || '', tag.name)) {
      selectedTagView.value = ROOT_VIEW
      if (sidebarPanel.value === 'tags') syncSidebarNavPath()
    }
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
const openWikiLink = async ({ target }: { target: string }) => {
  const linked = linkIndex.value.resolve(target)
  if (linked) { openNote(linked); return }
  const context = noteContextForView(folderViewId(selectedNote.value?.folderPath || ''))
  const created = await noteStore.addNote({ title: target, content: '', tagIds: context.tagIds, folderPath: context.folderPath })
  if (created) { ElMessage.success('已创建「' + target + '」'); openNote(created) }
}

const exportSelectedNoteHtml = async (
  note: Note,
  editor: InstanceType<typeof NoteEditor> | null = groupRefMap.get(groupContainingNote(note.id)?.id || '')?.getEditor() || null,
  root: ParentNode = document,
  tags = note.tagIds.map(id => noteStore.tags.find(tag => tag.id === id)).filter((tag): tag is Tag => !!tag),
) => {
  const wasSourceMode = !!groupSourceModes.value[note.id]
  try {
    if (wasSourceMode) {
      groupSourceModes.value = { ...groupSourceModes.value, [note.id]: false }
      await nextTick()
    }
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
  } finally {
    if (wasSourceMode) groupSourceModes.value = { ...groupSourceModes.value, [note.id]: true }
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
const saveOpenNoteBeforeLibraryChange = async (): Promise<boolean> => {
  if (!libraryWritable.value) return true
  for (const group of tabGroups.value) {
    const note = group.activeId ? noteForTab(group.activeId) : null
    if (!note) continue
    const editor = groupRefMap.get(group.id)?.getEditor()
    const content = editor?.getMarkdownForExport() ?? note.content
    const title = note.title
    if (content === note.content && title === note.title) continue
    const saved = await noteStore.updateNote(note.id, { title, content, pinned: note.pinned })
    if (!saved) {
      ElMessage.error('当前笔记未能保存，笔记库没有切换')
      return false
    }
  }
  return true
}
let libraryApplyGeneration = 0
const applyNotesLibraryChange = async (result: NotesLibraryInfo) => {
  const generation = ++libraryApplyGeneration
  pinnedTabStateReady.value = false
  closeTreeContextMenu()
  clearCache()
  resetMediaAssetMetadataCache()
  // 笔记正文与目录清单都按当前笔记库读取。先清空 store 并强制完整加载，
  // 同时让之前启动、尚未完成的旧库读取失效。
  noteStore.reset()
  libraryInfo.value = result
  sidebarPanel.value = 'files'
  selectedFolderView.value = ROOT_VIEW
  selectedTagView.value = ROOT_VIEW
  tabGroups.value = [makeTabGroup('primary', '主组')]
  activeGroupId.value = 'primary'
  pinnedTabIds.value = new Set()
  splitDirection.value = null
  groupSourceModes.value = {}
  await loadFolderFavorites()
  if (generation !== libraryApplyGeneration) return
  pageNav.setNavPath(['notes', ROOT_VIEW])
  await noteStore.loadData()
  if (generation !== libraryApplyGeneration) return
  await restorePinnedTabs(result.activeLibraryId)
  if (generation !== libraryApplyGeneration) return
  await initNavPath()
}
const refreshNotesLibrary = async (result?: NotesLibraryInfo) => {
  libraryInfo.value = result || await getNotesLibraryInfo()
  clearCache()
  resetMediaAssetMetadataCache()
  await loadFolderFavorites()
  await noteStore.syncFromRemote()
}
const openLibraryManager = async () => {
  libraryMenuOpen.value = false
  libraryManagerVisible.value = true
  try {
    const result = await getNotesLibraryInfo()
    libraryInfo.value = result
    if (!await saveOpenNoteBeforeLibraryChange()) return
    await refreshNotesLibrary(result)
  } catch (error) {
    logger.error('[笔记库] 刷新管理列表失败', { error: error instanceof Error ? error.message : String(error) })
  }
}
const chooseNotesLibrary = async () => {
  try {
    if (!await saveOpenNoteBeforeLibraryChange()) return
    const previous = libraryInfo.value
    const result = await selectNotesLibraryFolder()
    if (!result) return
    if (result.activeLibraryId === previous?.activeLibraryId) {
      await refreshNotesLibrary(result)
      libraryManagerVisible.value = false
      ElMessage.success('已重新读取当前笔记库的文件、文件夹和本地状态')
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
    if (!await saveOpenNoteBeforeLibraryChange()) return
    libraryMenuOpen.value = false
    try {
      await refreshNotesLibrary()
      if (closeManager) libraryManagerVisible.value = false
      ElMessage.success('已重新读取当前笔记库的文件、文件夹和本地状态')
    } catch (error) {
      logger.error('[笔记库] 刷新失败', { error: error instanceof Error ? error.message : String(error) })
      ElMessage.error(error instanceof Error ? error.message : '读取笔记库失败')
    }
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
const requestRemoveUnavailableLibrary = (library: { id: string; name: string; rootPath: string; rootExists: boolean }) => {
  if (library.rootExists) return
  unavailableLibraryToRemove.value = { id: library.id, name: library.name }
  removeUnavailableLibraryConfirm.value = true
}
const confirmRemoveUnavailableLibrary = async () => {
  const target = unavailableLibraryToRemove.value
  if (!target) return
  try {
    const previousActiveId = libraryInfo.value?.activeLibraryId || null
    if (target.id === previousActiveId && !await saveOpenNoteBeforeLibraryChange()) return
    const result = await removeUnavailableNotesLibrary(target.id)
    if (result.activeLibraryId !== previousActiveId) await applyNotesLibraryChange(result)
    else libraryInfo.value = result
    unavailableLibraryToRemove.value = null
    removeUnavailableLibraryConfirm.value = false
    ElMessage.success('已移除失效笔记库记录，磁盘文件未更改')
  } catch (error) {
    logger.error('[笔记库] 移除失效记录失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error(error instanceof Error ? error.message : '移除失效笔记库记录失败')
  }
}
const folderDialogVisible = ref(false)
const folderDialogMode = ref<'create' | 'rename' | 'move' | 'duplicate'>('create')
const folderDialogOriginalPath = ref('')
const folderDraft = ref('')
const moveNoteDialogVisible = ref(false)
const movingNote = ref<Note | null>(null)
const moveNoteTargetPath = ref('')
const moveNoteFolderOptions = computed(() => {
  return folderRows.value.map(folder => folder.path)
})
const moveNoteSelectOptions = computed(() => [
  { label: '笔记库根目录', value: '' },
  ...moveNoteFolderOptions.value.map(folder => ({ label: folder, value: folder })),
])
const noteRenameDialogVisible = ref(false)
const noteRenameTarget = ref<Note | null>(null)
const noteRenameDraft = ref('')
const openFolderDialog = (mode: 'create' | 'rename' | 'move' | 'duplicate', folderPath = '') => {
  if (!libraryWritable.value) { ElMessage.info('请先选择笔记库文件夹'); return }
  folderDialogMode.value = mode
  folderDialogOriginalPath.value = folderPath
  folderDraft.value = mode === 'rename' || mode === 'move' ? folderPath
    : mode === 'duplicate' ? folderPath + ' 副本'
      : folderPath ? folderPath + '/' : ''
  folderDialogVisible.value = true
}
const saveFolderDialog = async () => {
  const nextPath = folderDraft.value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!nextPath && folderDialogMode.value !== 'create') return
  if (!nextPath && folderDialogMode.value === 'create') return
  const oldPath = folderDialogOriginalPath.value
  try {
    if (folderDialogMode.value === 'create') {
      libraryInfo.value = await createNotesFolder(nextPath)
      const normalizedPath = nextPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      const parts = normalizedPath.split('/').filter(Boolean)
      const nextExpanded = new Set(expandedFolders.value)
      nextExpanded.add('')
      for (let index = 1; index <= parts.length; index++) nextExpanded.add(parts.slice(0, index).join('/'))
      expandedFolders.value = nextExpanded
      ElMessage.success('文件夹已创建')
    } else if (folderDialogMode.value === 'duplicate') {
      libraryInfo.value = await duplicateNotesFolder(oldPath, nextPath)
      clearCache()
      await noteStore.syncFromRemote()
      const parts = nextPath.split('/').filter(Boolean)
      const nextExpanded = new Set(expandedFolders.value)
      nextExpanded.add('')
      for (let index = 1; index <= parts.length; index++) nextExpanded.add(parts.slice(0, index).join('/'))
      expandedFolders.value = nextExpanded
      ElMessage.success('文件夹及其内容已复制')
    } else {
      const scope = tagScopeForView(selectedTagView.value)
      if (nextPath === oldPath) { folderDialogVisible.value = false; return }
      if (nextPath.startsWith(oldPath + '/')) { ElMessage.warning('不能将文件夹移动到自身内部'); return }
      const normalizedNextPath = nextPath
      const result = await renameNotesFolder(oldPath, normalizedNextPath)
      const remap = (path: string) => path === oldPath || path.startsWith(oldPath + '/')
        ? normalizedNextPath + path.slice(oldPath.length) : path
      expandedFolders.value = new Set([...expandedFolders.value].map(remap))
      libraryInfo.value = result
      favoriteFolderPaths.value = favoriteFolderPaths.value.map(remap)
      clearCache()
      await noteStore.syncFromRemote()
      const selectedFolderPath = folderPathFromView(selectedFolderView.value)
      if (isFolderView(selectedFolderView.value)
        && (selectedFolderPath === oldPath || selectedFolderPath.startsWith(oldPath + '/'))) {
        selectedFolderView.value = folderViewId(remap(selectedFolderPath))
      }
      if (searchFolderScope.value !== null
        && (searchFolderScope.value === oldPath || searchFolderScope.value.startsWith(oldPath + '/'))) {
        searchFolderScope.value = remap(searchFolderScope.value)
      }
      if (isTagPathView(selectedTagView.value) && scope
        && (scope.folderPath === oldPath || scope.folderPath.startsWith(oldPath + '/'))) {
        selectedTagView.value = tagPathViewId(remap(scope.folderPath), scope.tagPath)
      }
      if (selectedFolderView.value !== folderViewId(selectedFolderPath)
        || (isTagPathView(selectedTagView.value) && scope
          && (scope.folderPath === oldPath || scope.folderPath.startsWith(oldPath + '/')))) syncSidebarNavPath()
      ElMessage.success(folderDialogMode.value === 'move' ? '文件夹已移动' : '文件夹已重命名')
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
  const scope = tagScopeForView(selectedTagView.value)
  try {
    libraryInfo.value = await deleteNotesFolder(path)
    favoriteFolderPaths.value = favoriteFolderPaths.value.filter(folder => folder !== path && !folder.startsWith(path + '/'))
    persistFolderFavorites()
    clearCache()
    await noteStore.syncFromRemote()
    const viewFolder = folderPathFromView(selectedFolderView.value)
    const folderViewRemoved = isFolderView(selectedFolderView.value)
      && (viewFolder === path || viewFolder.startsWith(path + '/'))
    const tagViewRemoved = !!scope && (scope.folderPath === path || scope.folderPath.startsWith(path + '/'))
    if (searchFolderScope.value !== null
      && (searchFolderScope.value === path || searchFolderScope.value.startsWith(path + '/'))) searchFolderScope.value = null
    if (folderViewRemoved) selectedFolderView.value = ROOT_VIEW
    if (tagViewRemoved) selectedTagView.value = ROOT_VIEW
    if (folderViewRemoved || tagViewRemoved) syncSidebarNavPath()
    ElMessage.success('文件夹已删除')
  } catch (error) {
    logger.error('[笔记库] 删除文件夹失败', { error: error instanceof Error ? error.message : String(error) })
    ElMessage.error(error instanceof Error ? error.message : '删除文件夹失败')
  }
  folderDeleteVisible.value = false
}
const openMoveNoteDialog = (note: Note) => {
  if (!libraryWritable.value) return
  movingNote.value = note
  moveNoteTargetPath.value = note.folderPath || ''
  moveNoteDialogVisible.value = true
}
const moveNoteToSelectedFolder = async () => {
  const note = movingNote.value
  const folderPath = moveNoteTargetPath.value
  if (!note || !libraryWritable.value || folderPath === (note.folderPath || '')) return
  if (!await noteStore.moveNoteToFolder(note.id, folderPath)) {
    ElMessage.error('移动笔记失败')
  } else {
    if (selectedId.value === note.id) selectedFolderView.value = folderViewId(folderPath)
    syncSidebarNavPath()
    ElMessage.success(folderPath ? '已移动到「' + folderPath + '」' : '已移到笔记库根目录')
    moveNoteDialogVisible.value = false
  }
}
const mergeDialogVisible = ref(false)
const mergeSource = ref<Note | null>(null)
const mergeTargetId = ref('')
const mergeTargetOptions = computed(() => noteStore.notes.filter(note => note.id !== mergeSource.value?.id)
  .sort((a, b) => a.title.localeCompare(b.title, 'zh')))
const mergeTargetSelectOptions = computed(() => mergeTargetOptions.value.map(note => ({
  label: `${note.title || '新笔记'}（${note.folderPath || '笔记库根目录'}）`, value: note.id,
})))
const showMergeConfirm = ref(false)
const mergeConfirmMessage = computed(() => {
  const source = mergeSource.value
  const target = noteForTab(mergeTargetId.value)
  return `将「${source?.title || '新笔记'}」的正文和标签合并到「${target?.title || '新笔记'}」，然后永久删除来源笔记？`
})
const openMergeDialog = (source: Note) => {
  mergeSource.value = source
  mergeTargetId.value = ''
  mergeDialogVisible.value = true
}
const askMergeConfirm = () => { if (mergeSource.value && mergeTargetId.value) showMergeConfirm.value = true }
const mergeNotesConfirmed = async () => {
  const source = mergeSource.value
  const target = noteForTab(mergeTargetId.value)
  if (!source || !target || source.id === target.id || !libraryWritable.value) return
  const mappedTagIds = new Set(target.tagIds)
  for (const sourceTagId of source.tagIds) {
    const sourceTag = noteStore.tags.find(tag => tag.id === sourceTagId)
    if (!sourceTag) continue
    const existing = noteStore.tags.find(tag => tag.folderPath === (target.folderPath || '') && tag.name === sourceTag.name)
    if (existing) mappedTagIds.add(existing.id)
    else {
      const created = await noteStore.addTag({ name: sourceTag.name, color: sourceTag.color, folderPath: target.folderPath || '' })
      if (created) mappedTagIds.add(created.id)
    }
  }
  const section = `## ${source.title || '新笔记'}\n\n${source.content || ''}`
  const content = [target.content.trimEnd(), section].filter(Boolean).join('\n\n')
  if (!await noteStore.updateNote(target.id, { content, tagIds: [...mappedTagIds] })) {
    ElMessage.error('目标笔记更新失败，来源笔记仍然保留')
    return
  }
  if (!await noteStore.deleteNote(source.id)) {
    ElMessage.warning('正文已合并，但来源笔记永久删除失败')
    return
  }
  mergeDialogVisible.value = false
  showMergeConfirm.value = false
  mergeSource.value = null
  ElMessage.success('笔记已合并，来源笔记已永久删除')
}
const openNoteRenameDialog = (note: Note) => {
  noteRenameTarget.value = note
  noteRenameDraft.value = note.title || ''
  noteRenameDialogVisible.value = true
}
const saveNoteRename = async () => {
  const note = noteRenameTarget.value
  const title = noteRenameDraft.value.trim()
  if (!note || !title) return
  if (await noteStore.updateNote(note.id, { title })) {
    ElMessage.success('笔记已重命名')
    noteRenameDialogVisible.value = false
  } else ElMessage.error('重命名笔记失败')
}
const duplicateNote = async (source: Note) => {
  if (!libraryWritable.value) return
  const duplicate = await noteStore.addNote({
    title: (source.title || '新笔记') + ' 副本', content: source.content,
    tagIds: [...source.tagIds], folderPath: source.folderPath || '', pinned: false,
  })
  if (duplicate) openNoteInNewTab(duplicate)
}
const toggleNoteFavorite = async (note: Note) => {
  const wasPinned = note.pinned
  if (await noteStore.togglePin(note.id)) ElMessage.success(wasPinned ? '已取消收藏' : '已收藏')
}
const copyPathToClipboard = async (relativePath: string, kind: 'relative' | 'absolute' = 'absolute') => {
  const root = libraryInfo.value?.rootPath
  const separator = root?.includes('\\') ? '\\' : '/'
  const normalizedRelative = relativePath.replace(/[\\/]+/g, separator).replace(/^[\\/]+/g, '')
  const path = kind === 'relative' || !root
    ? relativePath.replace(/\\/g, '/')
    : [root.replace(/[\\/]+$/g, ''), normalizedRelative].filter(Boolean).join(separator)
  try {
    await navigator.clipboard.writeText(path)
    ElMessage.success(kind === 'relative' ? '笔记库相对路径已复制' : '绝对路径已复制')
  } catch { ElMessage.error('无法访问剪贴板') }
}
const copyFolderPath = async (folderPath: string, kind: 'relative' | 'absolute' = 'relative') => copyPathToClipboard(kind === 'relative' && !folderPath ? '.' : folderPath, kind)
const relativeNotePath = (note: Note) => getNoteLibraryNotePath(note.id)
const copyNotePath = async (note: Note, kind: 'relative' | 'absolute' = 'relative') => {
  try { await copyPathToClipboard(await relativeNotePath(note), kind) }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '无法获取笔记文件路径') }
}
const openNoteWithDefaultApp = async (note: Note) => {
  try {
    if (!await openNoteLibraryPath(await relativeNotePath(note))) ElMessage.error('未能使用默认应用打开笔记')
    else ElMessage.success('已使用系统默认应用打开笔记')
  }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '未能使用默认应用打开笔记') }
}
const revealNoteInLibrary = async (note: Note) => {
  try {
    if (!await revealNoteLibraryPath(await relativeNotePath(note))) ElMessage.error('未能在系统文件资源管理器中打开笔记')
    else ElMessage.success('已在系统文件资源管理器中打开笔记')
  }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '未能在系统文件资源管理器中打开笔记') }
}
const revealFolderInLibrary = async (folderPath: string) => {
  try {
    if (!await revealNoteLibraryPath(folderPath)) ElMessage.error('未能在系统文件资源管理器中打开文件夹')
    else ElMessage.success('已在系统文件资源管理器中打开文件夹')
  }
  catch (error) { ElMessage.error(error instanceof Error ? error.message : '未能在系统文件资源管理器中打开文件夹') }
}
const pdfExportDialogVisible = ref(false)
const pdfExportTarget = ref<Note | null>(null)
const pdfExportBusy = ref(false)
const pdfSettings = ref({ pageSize: 'Letter', margin: '0', scale: '100', landscape: false, includeTitle: true })
const pdfPageSizeOptions = [
  { label: 'Letter', value: 'Letter' }, { label: 'A4', value: 'A4' }, { label: 'Legal', value: 'Legal' },
]
const pdfMarginOptions = [
  { label: '无边距', value: '0' }, { label: '窄边距', value: '8' }, { label: '标准边距', value: '18' },
]
const pdfScaleOptions = [
  { label: '100%', value: '100' }, { label: '90%', value: '90' }, { label: '80%', value: '80' }, { label: '70%', value: '70' },
]
const buildPdfDocument = (title: string, bodyHtml: string, settings: typeof pdfSettings.value) => {
  const styles = Array.from(document.querySelectorAll('style'))
    .map(style => style.textContent || '')
    .filter(style => /markdown-body|ProseMirror|milkdown|katex|hljs|esd-media|md-editor/i.test(style))
    .join('\n')
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
    .map(link => `<link rel="stylesheet" href="${escapeHtml(link.href)}">`).join('')
  const margin = Math.max(0, Math.min(40, Number(settings.margin) || 0))
  const scale = Math.max(60, Math.min(120, Number(settings.scale) || 100))
  const pageDirection = settings.landscape ? 'landscape' : 'portrait'
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${escapeHtml(location.origin)}/"><title>${escapeHtml(title)}</title>${links}<style>${styles}
@page{size:${settings.pageSize} ${pageDirection};margin:${margin}mm}
html,body{margin:0!important;padding:0!important;width:auto!important;min-height:0!important;background:#fff!important;color:#202124!important;font-family:Arial,"Microsoft YaHei",sans-serif!important}
body{font-size:${scale}%;line-height:1.65}
.print-document{box-sizing:border-box;width:100%;max-width:none;margin:0 auto;padding:0;background:#fff;color:#202124;overflow:visible}
.print-note-title{margin:0 0 12px;font-size:24pt;line-height:1.25;color:#171717!important;overflow-wrap:anywhere}
.print-note-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px;color:#565656;font-size:9pt}
.print-note-tags span{display:inline-block;padding:2px 7px;border:1px solid #c9c9c9;border-radius:999px}
.md-editor,.editor-wrap,.editor-main,.editor-content-area,.markdown-body,.ProseMirror{box-sizing:border-box;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;background:#fff!important;color:#202124!important}
.markdown-body,.ProseMirror{max-width:none!important;margin:0!important;padding:0!important;font-size:11pt!important;line-height:1.65!important;color:#202124!important}
.markdown-body *,.ProseMirror *{color:#202124!important;background-color:transparent!important;box-shadow:none!important;text-shadow:none!important}
a{color:#2457a7!important;text-decoration:underline!important;overflow-wrap:anywhere}
img,svg,video,canvas{max-width:100%!important;height:auto!important;break-inside:avoid}
table{width:100%;max-width:100%;border-collapse:collapse;break-inside:auto}
thead{display:table-header-group}tr,blockquote,pre,figure{break-inside:avoid}
th,td{border:1px solid #c8c8c8!important;padding:5px 7px!important;vertical-align:top}
pre,code{white-space:pre-wrap!important;overflow-wrap:anywhere}
hr{border:0;border-top:1px solid #bbb}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-document{padding:0}}
</style></head><body><main class="print-document">${bodyHtml}</main></body></html>`
}
const escapeHtml = (value: string) => {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return value.replace(/[&<>"']/g, character => entities[character] || character)
}
const exportNotePdf = (note: Note) => {
  pdfExportTarget.value = note
  pdfExportDialogVisible.value = true
}
const runPdfExport = async () => {
  const note = pdfExportTarget.value
  if (!note || pdfExportBusy.value) return
  pdfExportBusy.value = true
  try {
    const group = groupContainingNote(note.id)
    const editor = group
      ? groupRefMap.get(group.id)?.getEditor()
      : [...groupRefMap.values()].map(groupComponent => groupComponent.getEditor()).find(Boolean) || null
    const rendered = editor?.renderMarkdownForExport(note.content)
    const exportBody = document.createElement('div')
    if (rendered) exportBody.appendChild(rendered)
    else exportBody.innerHTML = `<div class="markdown-body">${micromark(note.content || '')}</div>`
    exportBody.querySelectorAll('audio, video').forEach(media => media.remove())
    const exportImages = Array.from(exportBody.querySelectorAll<HTMLImageElement>('img'))
    for (const image of exportImages) {
      const reference = image.getAttribute('data-media-ref') || image.getAttribute('src') || ''
      if (!/^esd-local-media:\/\//i.test(reference)) continue
      const mediaUrl = await getMediaAssetUrl(reference)
      const dataUrl = mediaUrl ? '' : await readMediaAsset(mediaKeyFromReference(reference) || '')
      if (!mediaUrl && !dataUrl) throw new Error(`无法读取图片资源：${image.alt || reference}`)
      image.setAttribute('src', dataUrl || new URL(mediaUrl!, location.origin).href)
      image.removeAttribute('data-media-ref')
    }
    const bodyHtml = exportBody.innerHTML
    const tags = note.tagIds.map(id => noteStore.tags.find(tag => tag.id === id)?.name).filter(Boolean)
    const tagHtml = tags.length ? `<div class="print-note-tags">${tags.map(tag => `<span>${escapeHtml(tag || '')}</span>`).join('　')}</div>` : ''
    const titleHtml = pdfSettings.value.includeTitle ? `<h1 class="print-note-title">${escapeHtml(note.title || '新笔记')}</h1>` : ''
    const outputPath = await saveNotePdf(note.title || '新笔记', buildPdfDocument(note.title || '新笔记', titleHtml + tagHtml + bodyHtml, pdfSettings.value), pdfSettings.value)
    ElMessage.success(`PDF 已保存到：${outputPath}`)
    pdfExportDialogVisible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'PDF 导出失败')
  } finally {
    pdfExportBusy.value = false
  }
}
const findFolder = (folderPath: string) => {
  sidebarPanel.value = 'search'
  selectedFolderView.value = folderViewId(folderPath)
  searchFolderScope.value = folderPath
  query.value = ''
  syncSidebarNavPath()
  nextTick(() => searchInputRef.value?.focus())
}
const createNoteAtFolder = async (folderPath?: string) => {
  if (!libraryWritable.value) { ElMessage.warning('请先选择笔记库文件夹，再新建笔记'); return }
  const context = noteContextForView(folderPath === undefined ? currentView.value : folderViewId(folderPath))
  if (folderPath !== undefined) {
    sidebarPanel.value = 'files'
    selectedFolderView.value = folderViewId(context.folderPath)
  }
  const note = await noteStore.addNote({
    title: '新笔记', content: '', tagIds: context.tagIds, folderPath: context.folderPath, pinned: false,
  })
  if (!note) return
  openNote(note, activeGroupId.value)
}
const createNote = () => createNoteAtFolder()
const togglePin = async (note: Note) => { await noteStore.togglePin(note.id) }
const toggleFavoriteForTab = (id: string) => { const note = noteForTab(id); if (note) void togglePin(note) }

const showDeleteConfirm = ref(false)
const deletingId = ref<string | null>(null)
const deletingTitle = ref('')
const askDeleteNote = (note: Note) => {
  deletingId.value = note.id
  deletingTitle.value = note.title || '新笔记'
  showDeleteConfirm.value = true
}
const onDeleteConfirmed = async () => {
  const id = deletingId.value
  if (!id) return
  const wasActiveInPrimary = primaryGroup()?.activeId === id
  if (await noteStore.deleteNote(id)) ElMessage.success('笔记已永久删除')
  if (!noteStore.notes.some(note => note.id === id)) {
    for (const group of tabGroups.value) {
      const index = group.tabIds.indexOf(id)
      if (index < 0) continue
      group.tabIds.splice(index, 1)
      if (group.previewId === id) group.previewId = null
      if (group.activeId === id) group.activeId = group.tabIds[index] || group.tabIds[index - 1] || null
    }
    const nextPinned = new Set(pinnedTabIds.value)
    nextPinned.delete(id)
    pinnedTabIds.value = nextPinned
    persistPinnedTabs()
    tabGroups.value = tabGroups.value.filter((group, index) => index === 0 || group.tabIds.length || group.startOpen)
    if (!groupById(activeGroupId.value)) activeGroupId.value = 'primary'
    if (wasActiveInPrimary) pageNav.setNavPath(primaryGroup()?.activeId
      ? ['notes', navViewForPanel(), primaryGroup()!.activeId!]
      : ['notes', navViewForPanel()])
  }
  deletingId.value = null
  showDeleteConfirm.value = false
}
const FIXED_NEW_NOTE_COMBO = 'Ctrl+N'
const FIXED_TAG_PICKER_COMBO = 'Ctrl+Shift+T'
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    tagPickerOpen.value = false
    folderDialogVisible.value = false
    moveNoteDialogVisible.value = false
    mergeDialogVisible.value = false
    noteRenameDialogVisible.value = false
    closeTreeContextMenu()
    libraryMenuOpen.value = false
    libraryManagerVisible.value = false
    sortMenuOpen.value = false
    tabMenuOpen.value = false
    tabContextMenu.value = null
    splitMenuOpen.value = false
    return
  }
  const combo = comboFromEvent(event)
  if (combo === FIXED_TAG_PICKER_COMBO && activeNoteForGroup()) {
    event.preventDefault()
    openTagPicker()
  } else if (combo === FIXED_NEW_NOTE_COMBO) {
    event.preventDefault()
    void createNote()
  }
}
const onWindowFocus = async () => {
  try {
    const latest = await getNotesLibraryInfo()
    if (latest.activeLibraryId !== libraryInfo.value?.activeLibraryId) {
      await applyNotesLibraryChange(latest)
      return
    }
    libraryInfo.value = latest
    await noteStore.syncFromRemote()
  } catch (error) {
    logger.error('[笔记库] 窗口聚焦时刷新失败', { error: error instanceof Error ? error.message : String(error) })
  }
}
const onDocumentClick = () => {
  tagPickerOpen.value = false
  closeTreeContextMenu()
  libraryMenuOpen.value = false
  sortMenuOpen.value = false
  tabMenuOpen.value = false
  tabContextMenu.value = null
  splitMenuOpen.value = false
}
const initNavPath = async () => {
  let path = pageNav.navPath.value
  if (guideRunning.value) {
    const guideView = path[0] === 'notes' && isFolderView(path[1] || '') ? path[1] : ROOT_VIEW
    selectedFolderView.value = guideView
    if (path[0] !== 'notes' || path[1] !== guideView) path = ['notes', guideView]
    if (!path[2]) {
      const pinnedId = openTabIds.value.find(id => isTabPinned(id))
      if (pinnedId) path = ['notes', guideView, pinnedId]
    }
    sidebarPanel.value = 'files'
    const primary = primaryGroup()
    if (primary) {
      primary.startOpen = primary.tabIds.length === 0
      primary.startActive = primary.startOpen
    }
    if (path[2] && noteStore.notes.some(note => note.id === path[2])) {
      if (!openTabIds.value.includes(path[2])) openTabIds.value.push(path[2])
      previewTabId.value = isTabPinned(path[2]) ? null : path[2]
      if (primary) primary.activeId = path[2]
    }
    pageNav.setNavPath(path)
    return
  }
  if (path[0] !== 'notes' || path.length < 2) path = await restoreModuleNavPath('notes')
  if (path[0] !== 'notes') path = ['notes', ROOT_VIEW]
  const view = path[1] || ROOT_VIEW
  if (view === 'all') {
    const note = path[2] ? noteStore.notes.find(item => item.id === path[2]) : null
    path = note ? ['notes', folderViewId(note.folderPath || ''), note.id] : ['notes', ROOT_VIEW]
  } else if (path.length >= 3) {
    const note = noteStore.notes.find(item => item.id === path[2])
    if (note && view !== 'trash' && view !== 'favorites' && !isFolderView(view) && !isTagView(view)) path = ['notes', folderViewId(note.folderPath || ''), note.id]
    else if (!note) path = ['notes', view === 'favorites' ? 'favorites' : ROOT_VIEW]
  }
  const normalizedView = path[1] || ROOT_VIEW
  if (path[2] && !isTabPinned(path[2])) path = path.slice(0, 2)
  if (!path[2]) {
    const pinnedId = openTabIds.value.find(id => isTabPinned(id))
    if (pinnedId) path = ['notes', normalizedView, pinnedId]
  }
  if (normalizedView === 'trash') {
    sidebarPanel.value = 'files'
    selectedFolderView.value = ROOT_VIEW
    path = ['notes', ROOT_VIEW]
  } else if (normalizedView === 'favorites') {
    sidebarPanel.value = 'favorites'
    selectedFolderView.value = ROOT_VIEW
  } else if (isTagView(normalizedView)) {
    sidebarPanel.value = 'tags'
    selectedTagView.value = normalizedView
    const activeNote = path[2] ? noteStore.notes.find(note => note.id === path[2]) : null
    selectedFolderView.value = folderViewId(activeNote?.folderPath || '')
  } else if (isFolderView(normalizedView)) {
    sidebarPanel.value = 'files'
    selectedFolderView.value = normalizedView
  } else {
    sidebarPanel.value = 'files'
    selectedFolderView.value = ROOT_VIEW
    path = ['notes', ROOT_VIEW]
  }
  const primary = primaryGroup()
  if (primary) {
    if (path[2] && !primary.tabIds.includes(path[2])) primary.tabIds.push(path[2])
    if (path[2]) {
      primary.startOpen = false
      primary.startActive = false
      primary.activeId = path[2]
      primary.previewId = isTabPinned(path[2]) ? null : path[2]
    } else if (!primary.tabIds.length) {
      primary.startOpen = true
      primary.startActive = true
    }
  }
  activeGroupId.value = 'primary'
  pageNav.setNavPath(path)
}
onMounted(async () => {
  emit('fullscreen-change', false)
  window.addEventListener('resize', onSidebarWindowResize)
  await noteStore.loadData()
  try { libraryInfo.value = await getNotesLibraryInfo() }
  catch (error) { logger.error('[笔记库] 读取状态失败', { error: error instanceof Error ? error.message : String(error) }) }
  await loadFolderFavorites()
  await restorePinnedTabs(libraryInfo.value?.activeLibraryId || null)
  await initNavPath()
  void noteStore.syncFromRemote()
  window.addEventListener('focus', onWindowFocus)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  emit('fullscreen-change', false)
  stopSidebarResize()
  window.removeEventListener('resize', onSidebarWindowResize)
  window.removeEventListener('focus', onWindowFocus)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
/* 侧栏宽度通过右边界拖动调整 */
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
  background: transparent;
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

/* ====== 中栏：列表（卡片网格）======
   用户要求：
     · 列表区右边界延伸到应用窗口右侧（保留一定间距）
     · 卡片 16:9，同行等高，一行最多 3 张
     · 判定：available < 800+d → 1 张；< 1200+2d → 2 张；否则 3 张（d=16）
   卡片宽由 grid 的 1fr 自动分配，因此只需给出列数（--np-card-cols，由 JS 测量容器宽度后计算）。
   列表区宽度取决于侧栏状态和窗口宽度，与视口宽度并非一一对应。
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
  旧卡片编辑区只在选中笔记时显示；当前标签组编辑器由 NoteTabGroup 管理。
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

/* 标题与标签属性保持同行；文件夹移动收在图标按钮中，标题按内容伸缩。 */
.np-editor-head {
  /* 标题、文件夹操作与标签之间保留稳定间距。 */
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  padding: 4px 16px 10px;
}

.np-title-input {
  /* 标题输入框随文字伸缩，并保留最小宽度与最大宽度限制。 */
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
/* < 900px：旧卡片编辑布局 */
@media (max-width: 899px) {
  .notes-page {
    padding: 10px;
    gap: 10px;
  }

  /* 旧卡片布局窄屏编辑区规则 */
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
.np-nav {
  width:268px; flex:0 0 268px; position:relative; z-index:30; min-width:0; border:0; border-radius:0;
  background:transparent; overflow:visible; transition:width .18s ease,flex-basis .18s ease;
}
.np-nav.is-resizing { transition:none !important; }
.np-nav.is-collapsed { background:transparent; }
.np-nav.is-collapsed > :not(.np-sidebar-resizer) { display:none; }
.np-sidebar-resizer { position:absolute; top:0; right:-5px; z-index:50; width:10px; height:100%; outline:0; touch-action:none; cursor:col-resize; }
.np-sidebar-resizer::before { position:absolute; top:0; bottom:0; left:4px; width:1px; background:rgba(196,181,253,.18); content:""; transition:background .15s ease; }
.np-sidebar-resizer:hover::before,.np-sidebar-resizer:focus-visible::before { background:rgba(196,181,253,.7); }
.np-nav.is-collapsed .np-sidebar-resizer { right:-4px; width:8px; }
.np-nav.is-collapsed .np-sidebar-resizer::before { left:4px; background:rgba(196,181,253,.3); }
:global(html.np-sidebar-resizing),:global(html.np-sidebar-resizing *) { cursor:col-resize !important; user-select:none !important; }
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
.np-tree-chevron { padding:0; border:0; border-radius:4px; background:transparent; cursor:pointer; transition:transform .13s ease, background .13s ease; }
.np-tree-chevron:not(:disabled):hover { background:rgba(255,255,255,.08); color:var(--chalk-white-90); }
.np-tree-chevron:disabled { opacity:.38; cursor:default; }
.np-tree-chevron.expanded { transform:rotate(90deg); }
.np-tree-chevron .el-icon { font-size:11px; }
.np-tree-root-chevron { margin-left:7px; margin-right:6px; }
.np-tree-root .np-tree-row { flex:1; width:auto; padding-left:0; }
.np-tree-entry > .np-tree-row { flex:1; width:auto; margin-left:6px; padding-left:0; }
.np-tree-item-icon { flex:0 0 auto; color:var(--chalk-muted); font-size:14px; }
.np-tree-pin { flex:0 0 auto; margin-left:4px; color:#c4b5fd; font-size:13px; }
.np-folder-favorites { margin:2px 0 7px; padding:0 0 7px; border-bottom:1px solid rgba(255,255,255,.08); }
.np-folder-favorites-heading { display:flex; align-items:center; gap:6px; padding:6px 8px 4px; color:var(--chalk-dim); font-size:10px; }
.np-folder-favorites-heading .el-icon { color:#c4b5fd; }
.np-folder-favorite { display:flex; align-items:center; gap:7px; width:100%; min-width:0; height:27px; padding:0 8px; border:0; border-radius:5px; background:transparent; color:var(--chalk-white-70); font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.np-folder-favorite:hover,.np-folder-favorite.active { background:rgba(147,197,253,.12); color:var(--chalk-white-90); }
.np-folder-favorite .el-icon { flex:0 0 auto; color:var(--chalk-muted); }
.np-folder-favorite span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-tree-context-menu { position:fixed; z-index:1200; width:min(292px,calc(100vw - 16px)); box-sizing:border-box; max-height:calc(100vh - 16px); overflow:auto; padding:5px; border:1px solid rgba(255,255,255,.13); border-radius:10px; background:var(--chalk-card,#211d3b); color:#f3f0ff; box-shadow:0 16px 42px rgba(0,0,0,.46); }
.np-tree-context-menu button { display:flex; align-items:center; gap:10px; width:100%; min-height:34px; padding:0 10px; border:0; border-radius:6px; background:transparent; color:#f3f0ff; font:inherit; font-size:12px; text-align:left; cursor:pointer; }
.np-tree-context-menu button span { flex:1; min-width:0; }
.np-tree-context-menu button:hover { background:rgba(255,255,255,.09); color:var(--chalk-white-95); }
.np-tree-context-menu button .el-icon { flex:0 0 auto; color:#c7c2db; font-size:15px; }
.np-tree-context-menu button.danger, .np-tree-context-menu button.danger .el-icon { color:#fb7185; }
.np-tree-context-divider { height:1px; margin:5px 3px; background:rgba(255,255,255,.1); }
.np-tree-context-submenu { position:relative; }
.np-tree-context-submenu > button .submenu-arrow { margin-left:auto; transform:rotate(-90deg); }
.np-context-flyout { position:fixed; z-index:1301; width:min(224px,calc(100vw - 16px)); max-height:calc(100vh - 16px); overflow:auto; padding:5px; border:1px solid rgba(255,255,255,.14); border-radius:9px; background:var(--chalk-card,#211d3b); color:#f3f0ff; box-shadow:0 16px 42px rgba(0,0,0,.5); }
.np-context-flyout button { display:flex; align-items:center; width:100%; min-height:34px; padding:0 10px; border:0; border-radius:6px; background:transparent; color:#f3f0ff; font:inherit; font-size:12px; text-align:left; cursor:pointer; }
.np-context-flyout button:hover { background:rgba(255,255,255,.09); color:#fff; }
.np-context-flyout button span { flex:1; min-width:0; }
.np-context-flyout-empty { padding:8px 10px; color:rgba(243,240,255,.6); font-size:11px; }
.np-tab-context-menu { width:min(270px,calc(100vw - 16px)); color:#f3f0ff; }
.np-tree-empty { padding:10px 8px; color:var(--chalk-dim); font-size:11px; line-height:1.5; }
.np-tag-tree { padding:0 2px; }
.np-workspace { position:relative; display:flex; flex:1; flex-direction:column; min-width:0; min-height:0; overflow:hidden; padding:0; }
.np-layout-toolbar { display:none; }
.np-group-count { color:var(--chalk-dim); font-size:10px; }
.np-tabbar { position:relative; z-index:10; display:flex; flex:0 0 40px; align-items:center; gap:6px; margin:-16px -22px 12px; padding:0 10px; border-bottom:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.025); }
.np-tab-strip { display:flex; order:1; flex:1; align-items:flex-end; gap:3px; min-width:0; height:100%; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; }
.np-tab-item { display:flex; flex:0 1 220px; align-items:center; gap:2px; min-width:108px; max-width:240px; height:33px; margin-top:7px; padding:0 5px; border:1px solid transparent; border-bottom:0; border-radius:8px 8px 0 0; background:transparent; color:var(--chalk-muted); }
.np-tab-item.stacked { width:52px; flex:0 0 52px; min-width:0; max-width:52px; height:100%; min-height:0; margin:0; padding:7px 4px; border:1px solid transparent; border-radius:0; writing-mode:vertical-lr; text-orientation:sideways; }
.np-tab-item:hover { background:rgba(255,255,255,.045); color:var(--chalk-white-85); }
.np-tab-item.active { border-color:rgba(255,255,255,.1); background:var(--chalk-bg,#15122b); color:var(--chalk-white-90); }
.np-tab-item .np-tab { display:flex; flex:1 1 auto; align-items:center; gap:7px; min-width:0; height:100%; padding:0; border:0; background:transparent; color:inherit; font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.np-tab-item.stacked .np-tab { min-height:0; flex-direction:row; writing-mode:inherit; }
.np-tab-file { flex:0 0 auto; color:var(--chalk-dim); font-size:13px; }
.np-tab-title { min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-tab-item.stacked .np-tab-title { max-height:100%; writing-mode:inherit; text-orientation:sideways; }
.np-tab-item.stacked .np-tab-file, .np-tab-item.stacked .np-tab-pin, .np-tab-item.stacked .np-tab-close { writing-mode:horizontal-tb; }
.np-tab-item.stacked .np-tab-close { order:-1; opacity:1; }
.np-tab-item.stacked .np-tab { order:0; }
.np-tab-item.stacked .np-tab-pin { order:1; opacity:1; }
.np-tab-pin, .np-tab-close { display:grid; flex:0 0 17px; place-items:center; width:17px; height:17px; padding:0; border:0; border-radius:4px; background:transparent; color:var(--chalk-dim); cursor:pointer; }
.np-tab-pin { opacity:.55; }
.np-tab-item:hover .np-tab-pin, .np-tab-item.active .np-tab-pin, .np-tab-item.pinned .np-tab-pin { opacity:1; }
.np-tab-item.pinned .np-tab-pin { color:#c4b5fd; }
.np-tab-close { opacity:0; }
.np-tab-item:hover .np-tab-close, .np-tab-item.active .np-tab-close { opacity:1; }
.np-tab-pin:hover, .np-tab-close:hover { background:rgba(255,255,255,.12); color:var(--chalk-white-95); }
.np-tab-pin .el-icon { font-size:12px; }
.np-tab-close .el-icon { font-size:12px; }
.np-tab-controls { display:flex; order:2; flex:0 0 auto; align-items:center; gap:3px; height:100%; }
.np-tab-controls.stacked { order:0; flex-direction:row; height:100%; }
.np-tab-control { display:grid; place-items:center; width:28px; height:28px; padding:0; border:0; border-radius:6px; background:transparent; color:var(--chalk-muted); cursor:pointer; }
.np-tab-control:hover, .np-tab-control[aria-expanded="true"] { background:rgba(255,255,255,.08); color:var(--chalk-white-90); }
.np-tab-control .el-icon { font-size:15px; }
.np-tab-menu-wrap { position:relative; }
.np-tab-menu { position:absolute; top:calc(100% + 5px); right:0; z-index:80; width:176px; padding:5px; border:1px solid rgba(255,255,255,.12); border-radius:9px; background:var(--chalk-card,#211d3b); box-shadow:0 12px 32px rgba(0,0,0,.42); }
.np-tab-menu button { display:flex; align-items:center; gap:8px; width:100%; min-height:32px; padding:0 9px; border:0; border-radius:5px; background:transparent; color:var(--chalk-white-90); font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.np-tab-menu button:hover, .np-tab-menu button.active { background:rgba(255,255,255,.08); color:var(--chalk-white-95); }
.np-tab-menu button .el-icon { color:var(--chalk-muted); font-size:14px; }
.np-workspace-content { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(0,1fr); grid-template-rows:minmax(0,1fr); flex:1; min-width:0; min-height:0; overflow:hidden; }
.np-workspace-content.is-split-horizontal { grid-auto-flow:row; grid-auto-columns:unset; grid-template-columns:minmax(0,1fr); grid-auto-rows:minmax(0,1fr); }
.np-workspace-primary { display:flex; flex:1 1 0; min-width:0; min-height:0; flex-direction:column; overflow:hidden; }
.np-workspace-primary.stacked { flex-direction:column; }
.np-workspace-content.is-split-vertical { flex-direction:row; }
.np-workspace-content.is-split-horizontal { flex-direction:column; }
.np-secondary-pane { display:flex; flex:1 1 0; min-width:0; min-height:0; flex-direction:column; overflow:hidden; border-left:1px solid rgba(255,255,255,.1); }
.np-secondary-pane.stacked { flex-direction:column; }
.np-workspace-content.is-split-horizontal .np-secondary-pane { border-top:1px solid rgba(255,255,255,.1); border-left:0; }
.np-secondary-header { display:flex; flex:0 0 36px; align-items:center; gap:6px; padding:0 8px; border-bottom:1px solid rgba(255,255,255,.07); }
.np-secondary-header button { display:grid; place-items:center; flex:0 0 24px; width:24px; height:24px; padding:0; border:0; border-radius:5px; background:transparent; color:var(--chalk-muted); cursor:pointer; }
.np-secondary-header button:hover { background:rgba(255,255,255,.08); color:var(--chalk-white-90); }
.np-secondary-tab { display:flex !important; flex:1 1 auto !important; align-items:center; gap:7px; min-width:0; height:28px !important; padding:0 6px !important; color:var(--chalk-white-75) !important; text-align:left; }
.np-secondary-tab span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-secondary-tab.active { background:rgba(255,255,255,.07) !important; color:var(--chalk-white-95) !important; }
.np-secondary-header.stacked { flex:0 0 36px; }
.np-secondary-tab-strip { display:flex; flex:1; align-items:flex-end; gap:3px; min-width:0; height:100%; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; }
.np-secondary-tab-strip .np-tab-item { height:31px; margin-top:0; }
.np-stacked-panes { display:flex; flex:1; min-width:0; min-height:0; overflow:auto; scrollbar-width:thin; }
.np-stacked-leaf { display:flex; flex:1 0 min(700px, 100%); min-width:280px; min-height:0; overflow:hidden; border-right:1px solid rgba(255,255,255,.12); }
.np-stacked-leaf.active { box-shadow:inset 0 0 0 1px rgba(196,181,253,.19); }
.np-stacked-leaf-tab { display:flex; flex:0 0 38px; min-height:0; flex-direction:column; align-items:center; gap:4px; padding:5px 3px; border-right:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.025); color:var(--chalk-muted); }
.np-stacked-leaf-tab .np-tab { display:flex; flex:1; align-items:center; justify-content:flex-start; min-width:0; min-height:0; flex-direction:column; padding:3px 0; border:0; background:transparent; color:inherit; font:inherit; cursor:pointer; writing-mode:vertical-rl; text-orientation:sideways; }
.np-stacked-leaf-tab .np-tab-title { max-height:100%; flex:1; writing-mode:inherit; text-orientation:inherit; }
.np-stacked-leaf-tab .np-tab-close, .np-stacked-leaf-tab .np-tab-pin { flex:0 0 22px; width:22px; height:22px; opacity:1; writing-mode:horizontal-tb; }
.np-stacked-leaf-content { display:flex; flex:1; min-width:0; min-height:0; flex-direction:column; overflow:hidden; padding:10px 12px 0; }
.np-stacked-leaf-content h2 { flex:0 0 auto; margin:0 0 8px; overflow:hidden; color:var(--chalk-white-90); font-size:16px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.np-stacked-leaf-content :deep(.editor-wrap) { flex:1; min-width:0; min-height:0; }
.np-stacked-welcome-leaf .np-stacked-leaf-content { padding:12px; }
.np-secondary-pane.active { box-shadow:inset 0 0 0 1px rgba(196,181,253,.17); }
.np-secondary-editor { display:flex; flex:1; min-width:0; min-height:0; flex-direction:column; overflow:hidden; padding:8px 10px 0; }
.np-secondary-editor h2 { flex:0 0 auto; margin:0 0 8px; overflow:hidden; color:var(--chalk-white-90); font-size:16px; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }
.np-secondary-editor :deep(.editor-wrap) { flex:1; min-height:0; }
.np-secondary-welcome { overflow:auto; padding:16px; }
.np-editor { display:flex !important; flex:1; min-width:0; min-height:0; background:transparent; border:0; border-radius:0; overflow:hidden; }
.np-editor-main { width:100%; }
.np-editor-head { padding:4px 2px 12px; border-bottom:1px solid rgba(255,255,255,.07); }
.np-editor-body { position:relative; padding-top:12px; }
.np-empty-state { display:flex; flex:1; min-height:0; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:var(--chalk-muted); text-align:center; }
.np-empty-state > .el-icon { color:rgba(147,197,253,.6); font-size:30px; }
.np-empty-state strong { color:var(--chalk-white-85); font-size:15px; font-weight:600; }
.np-empty-state > span { color:var(--chalk-dim); font-size:12px; }
.np-empty-state > button { display:inline-flex; align-items:center; gap:6px; margin-top:4px; padding:7px 12px; border:1px solid rgba(147,197,253,.28); border-radius:7px; background:rgba(102,126,234,.16); color:#bfdbfe; font:inherit; font-size:12px; cursor:pointer; }
.np-empty-state > button:hover { background:rgba(102,126,234,.26); }
.np-count-badge { display:inline-grid; min-width:18px; height:18px; place-items:center; padding:0 4px; border-radius:9px; background:rgba(255,255,255,.07); color:var(--chalk-dim); font-size:10px; font-weight:500; letter-spacing:0; }
.np-favorites-empty { display:flex; flex:1; align-items:center; justify-content:center; flex-direction:column; gap:8px; color:var(--chalk-dim); font-size:11px; }
.np-favorites-empty .el-icon { color:var(--chalk-muted); font-size:20px; }
.np-search-result small { display:block; margin-top:3px; overflow:hidden; color:var(--chalk-white-60); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
.np-dialog-form { display:flex; flex-direction:column; gap:10px; min-width:0; }
.np-dialog-form label { color:var(--chalk-white-75); font-size:12px; }
.np-dialog-form > input { width:100%; min-height:36px; box-sizing:border-box; padding:8px 10px; border:1px solid rgba(255,255,255,.14); border-radius:8px; outline:0; background:rgba(255,255,255,.06); color:#f3f0ff; font:inherit; font-size:12px; }
.np-dialog-form > input:focus { border-color:rgba(167,139,250,.65); }
.np-dialog-form p { margin:0; color:var(--chalk-white-60); font-size:11px; line-height:1.55; }
.np-tag-picker-search { width:100%; min-height:34px; box-sizing:border-box; margin:0 0 8px; padding:7px 9px; border:1px solid rgba(255,255,255,.14); border-radius:7px; outline:0; background:rgba(255,255,255,.06); color:#f3f0ff; font:inherit; font-size:12px; }
.np-tag-picker-search:focus { border-color:rgba(167,139,250,.6); }
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
.np-search-scope { display:flex; align-items:center; justify-content:space-between; gap:8px; min-width:0; margin:-3px 10px 8px; padding:5px 8px; border:1px solid rgba(167,139,250,.2); border-radius:6px; background:rgba(139,92,246,.08); color:var(--chalk-white-65); font-size:10px; }
.np-search-scope span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.np-search-scope button { flex:0 0 auto; padding:2px 5px; border:0; border-radius:4px; background:transparent; color:var(--chalk-white-75); font:inherit; cursor:pointer; }
.np-search-scope button:hover { background:rgba(255,255,255,.08); color:var(--chalk-white-95); }
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
.np-folder-dialog-mask { position:fixed; inset:0; z-index:2200; display:grid; place-items:center; padding:18px; background:rgba(4,3,12,.68); backdrop-filter:blur(4px); }
.np-folder-dialog { display:flex; width:min(420px, 94vw); flex-direction:column; gap:9px; padding:19px; border:1px solid rgba(255,255,255,.13); border-radius:11px; background:var(--chalk-card,#211d3b); color:var(--chalk-white-90); box-shadow:0 18px 50px rgba(0,0,0,.48); }
.np-folder-dialog h3 { margin:0 0 3px; font-size:15px; font-weight:600; }
.np-folder-dialog label { color:var(--chalk-muted); font-size:11px; }
.np-folder-dialog input, .np-folder-dialog select { width:100%; min-height:34px; box-sizing:border-box; padding:7px 9px; border:1px solid rgba(255,255,255,.13); border-radius:6px; outline:0; background:rgba(255,255,255,.055); color:var(--chalk-white-90); font:inherit; font-size:12px; }
.np-folder-dialog select option { background:var(--chalk-card,#211d3b); color:var(--chalk-white-90); }
.np-folder-dialog input:focus, .np-folder-dialog select:focus { border-color:rgba(147,197,253,.55); }
.np-folder-dialog p { margin:0; color:var(--chalk-dim); font-size:10px; line-height:1.5; }
.np-folder-dialog-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:7px; }
.np-folder-dialog-actions button { min-width:64px; padding:7px 11px; border:1px solid rgba(255,255,255,.12); border-radius:6px; background:rgba(255,255,255,.06); color:var(--chalk-white-85); font:inherit; font-size:11px; cursor:pointer; }
.np-folder-dialog-actions button[type="submit"] { border-color:#8757e8; background:#8757e8; color:#fff; }
.np-folder-dialog-actions button:disabled { opacity:.45; cursor:not-allowed; }
.np-library-menu-divider { height:1px; margin:5px 3px; background:rgba(255,255,255,.08); }
.np-library-menu-manage { display:flex; align-items:center; gap:8px; width:100%; padding:8px 9px; border:0; border-radius:6px; background:transparent; color:var(--chalk-white-85); font:inherit; font-size:11px; text-align:left; cursor:pointer; }
.np-library-menu-manage:hover { background:rgba(255,255,255,.07); color:var(--chalk-white-95); }
.np-library-manager-mask { position:fixed; inset:0; z-index:3000; display:grid; place-items:center; padding:24px; background:rgba(4,3,12,.72); backdrop-filter:blur(5px); }
.np-library-manager { display:grid; grid-template-columns:minmax(220px, 35%) minmax(0,1fr); width:min(980px, 94vw); height:min(760px, 88vh); overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:12px; background:#1c1c1c; box-shadow:0 24px 80px rgba(0,0,0,.5); color:var(--chalk-white-90); }
.np-library-manager-list { min-width:0; padding:22px 16px; overflow:auto; background:#262626; border-right:1px solid rgba(255,255,255,.08); }
.np-library-manager-row { display:flex; align-items:center; gap:4px; margin:3px 0; }
.np-library-manager-entry { display:flex; align-items:center; gap:8px; flex:1; min-width:0; width:0; margin:0; padding:9px 7px; border:0; border-radius:6px; background:transparent; color:var(--chalk-white-85); text-align:left; cursor:pointer; }
.np-library-manager-entry:hover, .np-library-manager-entry.active { background:rgba(255,255,255,.07); }
.np-library-manager-entry:disabled { opacity:.45; cursor:not-allowed; }
.np-library-manager-entry > span:first-child { display:flex; min-width:0; flex:1; flex-direction:column; gap:3px; }
.np-library-manager-entry strong { font-size:12px; font-weight:500; }
.np-library-manager-entry small { overflow:hidden; color:var(--chalk-dim); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
.np-library-manager-entry-status { flex:0 0 auto; color:#c4b5fd; font-size:9px; }
.np-library-manager-remove { display:grid; flex:0 0 30px; place-items:center; width:30px; height:30px; padding:0; border:0; border-radius:6px; background:transparent; color:var(--chalk-muted); cursor:pointer; }
.np-library-manager-remove:hover { background:rgba(248,113,113,.12); color:#fca5a5; }
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
@media (max-width: 1099px) {
  :global(.app-container.desktop-layout > .main-content) { z-index:30; }
  .np-nav { position:relative; inset:auto; z-index:30; transform:none; background:transparent; backdrop-filter:none; box-shadow:none; }
  .np-workspace { min-width:0; padding:0; }
  .np-workspace-content > .np-tab-group:first-child :deep(.np-group-tabbar) { padding-left:0; }
  .np-stacked-leaf-tab { flex-basis:34px; }
}
@media (max-width: 620px) {
  .np-sidebar-toolbar { gap:1px; padding:0 4px; }
  .np-sidebar-toolbar > button { width:24px; height:24px; }
  .np-workspace { padding:0; }
  .np-workspace-content > .np-tab-group:first-child :deep(.np-group-tabbar) { padding-left:0; }
  .np-tab-item { flex-basis:160px; }
  .np-stacked-leaf { flex-basis:min(560px, 100%); }
  .np-stacked-leaf-tab { flex-basis:32px; }
  .np-workspace-content.is-split-vertical { grid-auto-flow:row; grid-auto-columns:unset; grid-template-columns:minmax(0,1fr); grid-auto-rows:minmax(0,1fr); }
  .np-workspace-content.is-split-vertical :deep(.np-tab-group + .np-tab-group) { border-top:1px solid rgba(255,255,255,.12); border-left:0; }
  .np-editor-head { align-items:flex-start; flex-direction:column; }
  .np-props { padding:0; }
}
@media (max-width: 700px) {
  .np-library-manager-mask { padding:12px; }
  .np-library-manager { grid-template-columns:1fr; grid-template-rows:minmax(100px, 28%) minmax(0,1fr); width:100%; height:min(700px,94vh); }
  .np-library-manager-list { padding:12px; border-right:0; border-bottom:1px solid rgba(255,255,255,.08); }
  .np-library-manager-row { width:100%; }
  .np-library-manager-entry { display:flex; width:auto; }
  .np-library-manager-main { padding:34px 14px 18px; }
  .np-library-manager-options { padding:4px 12px; }
  .np-library-manager-options section { gap:8px; padding:13px 0; }
  .np-library-manager-options button { flex-basis:74px; }
}
.tag-picker-mask { z-index:2300; }
.np-tag-picker-dialog { width:min(360px,94vw); }
.np-tag-picker-list { display:flex; max-height:min(360px,52vh); flex-direction:column; overflow:auto; gap:2px; }
.np-tag-picker-list button { display:flex; align-items:center; gap:9px; min-height:34px; padding:0 8px; border:0; border-radius:6px; background:transparent; color:var(--chalk-white-75); font:inherit; font-size:12px; text-align:left; cursor:pointer; }
.np-tag-picker-list button:hover,.np-tag-picker-list button.selected { background:rgba(147,197,253,.12); color:var(--chalk-white-95); }
.np-tag-picker-check { display:grid; flex:0 0 16px; width:16px; height:16px; place-items:center; border:1px solid rgba(255,255,255,.25); border-radius:4px; color:#c4b5fd; font-size:12px; }
.np-tag-picker-list button.selected .np-tag-picker-check { border-color:#a78bfa; background:rgba(139,92,246,.28); }
</style>
