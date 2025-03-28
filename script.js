console.log('脚本开始加载...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM内容已加载');
    const rawBookmarksContainer = document.getElementById('raw-bookmarks');
    if (!rawBookmarksContainer) {
        console.error('未找到raw-bookmarks元素');
        return;
    }
    const folderList = document.getElementById('folder-list');
    const bookmarksGrid = document.getElementById('bookmarks-grid');
    const currentFolderTitle = document.getElementById('current-folder-title');
    const searchBox = document.getElementById('search-box');

    // 验证必要的DOM元素
    if (!bookmarksGrid || !folderList || !searchBox) {
        console.error('缺少必要的DOM元素');
        return;
    }

    // --- 1. 解析原始书签数据 ---
    function parseBookmarks(dlElement, parentFolderId, isRoot = false) {
        console.log(`开始解析书签，父文件夹ID: ${parentFolderId}, 是否根目录: ${isRoot}`);
        console.log('当前DL元素:', dlElement.outerHTML);
        
        let items = [];
        // 修改这里：查找所有直接的 DT 或 P > DT
        const elements = Array.from(dlElement.querySelectorAll(':scope > dt, :scope > p > dt'));
        console.log(`找到 ${elements.length} 个 DT 元素 (包括 P 内的)`);

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i]; // 现在 element 保证是 DT

            const dtContent = {
                h3: element.querySelector('H3'),
                a: element.querySelector('A')
            };

            // 获取 DT 的下一个兄弟元素，用于查找子 DL
            // 需要考虑 DT 可能在 P 里面，所以要找 P 的下一个兄弟，或者 DT 的下一个兄弟
            let nextSibling = element.nextElementSibling;
            if (element.parentElement.tagName === 'P') {
                nextSibling = element.parentElement.nextElementSibling;
            }

            // 检查是否是文件夹（有H3标签的就是文件夹）
            if (dtContent.h3) {
                // 处理文件夹
                const folderName = dtContent.h3.textContent.trim();
                const folderId = `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                
                // 创建文件夹项
                const folderItem = {
                    type: 'folder',
                    id: folderId,
                    title: folderName,
                    parentId: parentFolderId,
                    isRoot: isRoot
                };
                items.push(folderItem);
                console.log(`发现文件夹: "${folderName}"`);
                console.log(`创建文件夹ID: ${folderId}`);
                console.log(`父文件夹ID: ${parentFolderId}`);

                // --- 移除侧边栏渲染 ---
                // const li = document.createElement('li');
                // li.textContent = folderName;
                // li.dataset.folderId = folderId;
                // folderList.appendChild(li);

                // --- 根据日志修正：查找 DT 内部的 DL ---
                const currentElement = element; // 当前处理的 DT
                // Modified selector: find any DL descendant
                const nextDL = currentElement.querySelector(':scope dl');

                console.log(`文件夹 "${folderName}" ${nextDL ? '有' : '没有'}子内容 (在DT内部查找)`);


                if (nextDL) {
                    console.log(`开始处理文件夹 "${folderName}" 的子内容`);
                    const nestedItems = parseBookmarks(nextDL, folderId, false);
                    console.log(`文件夹 "${folderName}" 包含 ${nestedItems.length} 个子项`);
                    items = items.concat(nestedItems);
                    // 注意：因为我们是 querySelectorAll，这里的 i++ 可能不再需要，
                    // 但保留它可能有助于跳过某些结构，需要测试。暂时移除以简化。
                    // i++; // 跳过已处理的DL - 移除，因为 querySelectorAll 不依赖索引跳跃
                }
            } else if (dtContent.a) {
                // 处理书签 (现在 element 必然是 DT)
                const url = dtContent.a.href;
                const title = dtContent.a.textContent.trim();
                const bookmarkFolderId = parentFolderId; // 明确捕获将要分配的ID
                console.log(`发现书签: "${title}" -> ${url}`);
                console.log(`所属文件夹ID (parentFolderId): ${parentFolderId}`);
                console.log(`将分配给书签的 folderId: ${bookmarkFolderId}`); // 打印分配的ID

                items.push({
                    type: 'bookmark',
                    id: `bookmark-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    title: title,
                    url: url,
                    folderId: bookmarkFolderId // 使用捕获的变量
                });
            }
        }

        return items;
    }

    // --- 2. 开始处理书签数据 ---
    // --- 修改：渲染侧边栏函数以支持层级 ---
    function renderSidebar(data, listElement) {
        listElement.innerHTML = ''; // 清空现有列表

        // 1. 添加根目录 "所有书签"
        const rootLi = document.createElement('li');
        rootLi.textContent = '😎😎 所有书签 😎😎';
        rootLi.dataset.folderId = 'all';
        rootLi.classList.add('active'); // 默认选中
        listElement.appendChild(rootLi);
        console.log('添加根目录到侧边栏');

        // 2. 准备数据以便递归
        const folders = data.filter(item => item.type === 'folder');
        const foldersByParentId = folders.reduce((acc, folder) => {
            const parentId = folder.parentId || 'all'; // 确保有 parentId
            if (!acc[parentId]) {
                acc[parentId] = [];
            }
            acc[parentId].push(folder);
            return acc;
        }, {});

        // 3. 递归渲染函数 (修改以支持折叠和嵌套UL)
        function renderFolderLevel(parentId, level, parentElement) {
            const children = foldersByParentId[parentId] || [];
            if (children.length === 0) {
                return; // 没有子文件夹，直接返回
            }

            // 创建嵌套的 UL
            const ul = document.createElement('ul');
            ul.classList.add('nested-list');
            if (level > 1) { // 非顶层嵌套默认折叠
                ul.classList.add('collapsed');
            }
            parentElement.appendChild(ul); // 将 UL 添加到父 LI 或根 listElement

            children.sort((a, b) => a.title.localeCompare(b.title)); // 按名称排序文件夹

            children.forEach((folder, index) => {
                const li = document.createElement('li');
                li.dataset.folderId = folder.id;
                li.classList.add('folder-item');

                // Check if it's the last child in this UL
                if (index === children.length - 1) {
                    li.classList.add('is-last-child');
                }

                // Set CSS variable for indentation level (relative to sidebar, not parent UL)
                li.style.setProperty('--indent-level', level);

                // 内容容器，用于Flex布局
                const contentWrapper = document.createElement('div');
                contentWrapper.classList.add('folder-content-wrapper');

                // 添加切换图标 (如果它有子文件夹)
                const hasChildren = foldersByParentId[folder.id] && foldersByParentId[folder.id].length > 0;
                if (hasChildren) {
                    const toggleIcon = document.createElement('span');
                    toggleIcon.className = 'toggle-icon';
                    toggleIcon.textContent = '▶'; // 初始为折叠状态
                    if (level === 1) toggleIcon.textContent = '▼'; // 顶层默认展开
                    contentWrapper.appendChild(toggleIcon);
                    li.classList.add('has-children'); // 标记有子项
                } else {
                    // 添加占位符以保持对齐
                    const placeholder = document.createElement('span');
                    placeholder.className = 'toggle-icon-placeholder';
                    contentWrapper.appendChild(placeholder);
                }

                // 创建文件夹图标元素
                const icon = document.createElement('i');
                icon.className = 'fas fa-folder folder-icon';

                // 创建文本节点
                const text = document.createElement('span'); // Use span for better control
                text.className = 'folder-title-text';
                text.textContent = folder.title;

                // 添加图标和文本到内容容器
                contentWrapper.appendChild(icon);
                contentWrapper.appendChild(text);

                // 添加内容容器到 li
                li.appendChild(contentWrapper);

                // 将 LI 添加到当前的 UL
                ul.appendChild(li);

                // 递归渲染子文件夹，将子 UL 附加到当前 LI
                if (hasChildren) {
                    renderFolderLevel(folder.id, level + 1, li); // Pass current LI as parentElement
                }
            });
        }

        // 4. 开始从根级别 ('all') 渲染，将顶层 UL 附加到 listElement
        console.log('开始渲染文件夹层级...');
        renderFolderLevel('all', 1, listElement); // Pass listElement for the top level
        console.log(`渲染了 ${folders.length} 个文件夹到侧边栏`);
    }


    // --- 2. 加载或解析书签数据 ---
    const localStorageKey = 'myNavPageBookmarksData';
    let allBookmarksData = [];
    let folderMap = new Map(); // 新增：用于快速查找文件夹对象

    try {
        const storedData = localStorage.getItem(localStorageKey);
        if (storedData) {
            console.log('从 Local Storage 加载书签数据...');
            allBookmarksData = JSON.parse(storedData);
            if (!Array.isArray(allBookmarksData)) {
                console.warn('Local Storage 中的数据格式不正确，将重新解析。');
                allBookmarksData = []; // 重置以触发重新解析
            } else {
                console.log(`成功从 Local Storage 加载 ${allBookmarksData.length} 条数据。`);
            }
        } else {
            console.log('Local Storage 中无数据。');
        }
    } catch (error) {
        console.error('从 Local Storage 加载或解析数据时出错:', error);
        allBookmarksData = []; // 出错时重置，触发重新解析
    }

    // 如果 Local Storage 中没有有效数据，则从 HTML 解析
    if (allBookmarksData.length === 0) {
        console.log('开始从 HTML 解析书签数据...');
        const rootDl = rawBookmarksContainer.querySelector('DL');
        if (rootDl) {
            console.log('找到根DL元素，结构为:', rootDl.outerHTML);
            try {
                // 解析数据
                allBookmarksData = parseBookmarks(rootDl, 'all', true);
                console.log('成功解析书签数据:', allBookmarksData);

                // --- 保存到 Local Storage ---
                try {
                    localStorage.setItem(localStorageKey, JSON.stringify(allBookmarksData));
                    console.log('已将解析的数据保存到 Local Storage。');
                } catch (saveError) {
                    console.error('保存数据到 Local Storage 时出错:', saveError);
                }
                // --- 保存结束 ---

            } catch (parseError) {
                console.error('解析书签时发生错误:', parseError);
                allBookmarksData = []; // 解析出错则为空
            }
        } else {
            console.error('未找到根DL元素!');
            console.log('原始容器内容:', rawBookmarksContainer.innerHTML);
            allBookmarksData = []; // 未找到根则为空
        }
    }

    // --- 填充 folderMap ---
    folderMap.clear(); // 清空旧的映射（如果重新解析）
    allBookmarksData.forEach(item => {
        if (item.type === 'folder') {
            folderMap.set(item.id, item);
        }
    });
    console.log(`已填充 folderMap，包含 ${folderMap.size} 个文件夹。`);
    // --- 填充结束 ---


    // --- 渲染侧边栏和初始书签视图 ---
    try {
        renderSidebar(allBookmarksData, folderList);
    } catch (sidebarError) {
        console.error('渲染侧边栏时出错:', sidebarError);
    }

    // --- 移除在此处添加根目录的代码 --- (已移至 renderSidebar)
    // const rootLi = document.createElement('li');
    // --- 3. 渲染书签卡片 (初始视图) ---
    function renderBookmarks(items) {
        // 过滤掉非书签项，以防万一传入了包含文件夹的数据
        const bookmarksToRender = items.filter(item => item.type === 'bookmark');
        console.log(`开始渲染书签, 传入 ${items.length} 项, 实际渲染 ${bookmarksToRender.length} 个书签`);
        bookmarksGrid.innerHTML = '';

        if (!Array.isArray(bookmarksToRender) || bookmarksToRender.length === 0) {
            console.log('没有书签数据可显示');
            const message = document.createElement('div');
            message.textContent = '暂无书签';
            message.style.textAlign = 'center';
            message.style.padding = '20px';
            bookmarksGrid.appendChild(message);
            return;
        }

        // --- 移除不再需要的文件夹结构构建 ---
        // const folders = items.filter(item => item.type === 'folder').reduce((acc, folder) => {
        //     acc[folder.id] = folder;
        //     return acc;
        // }, {});
        // console.log('文件夹结构:', folders);

        // 遍历书签项进行渲染
        bookmarksToRender.forEach((item, index) => {
            // 这里不再需要检查 item.type === 'bookmark'，因为上面已经过滤了
            try { // try 块开始
                const card = document.createElement('div');
                card.className = 'bookmark-card';
                card.dataset.folder = item.folderId;
                card.dataset.title = item.title.toLowerCase();
                card.dataset.url = item.url.toLowerCase();

                const link = document.createElement('a');
                link.href = item.url;
                link.target = '_blank';

                const favicon = document.createElement('img');
                favicon.className = 'bookmark-favicon';
                try {
                    const domain = new URL(item.url).hostname;
                    favicon.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                } catch (e) {
                    favicon.src = 'placeholder.png';
                }
                favicon.alt = '';
                favicon.onerror = () => { favicon.src = 'placeholder.png'; };

                const titleSpan = document.createElement('span');
                titleSpan.className = 'bookmark-title';
                titleSpan.textContent = item.title;

                link.appendChild(favicon);
                link.appendChild(titleSpan);
                card.appendChild(link);
                bookmarksGrid.appendChild(card);

                console.log('成功创建书签卡片:', item.title);
            } catch (error) { // catch 块开始
                console.error('渲染书签时出错:', error, item);
            } // catch 块结束
            // forEach 回调函数的结束括号
        }); // forEach 结束
    }

    // 初始渲染
    try {
        console.log('开始初始渲染...');
        renderBookmarks(allBookmarksData);
        console.log('初始渲染完成');
    } catch (error) {
        console.error('初始渲染失败:', error);
    }

    // --- 4. 处理文件夹切换 ---
    // --- 4. 处理文件夹切换 (修改以包含折叠逻辑) ---
        // --- 4. 处理文件夹切换 (修改以包含折叠逻辑和处理 "所有书签") ---
        folderList.addEventListener('click', (e) => {
            const target = e.target;
            // CHANGE: Find the closest LI regardless of class first
            const clickedLi = target.closest('li');
    
            // If the click wasn't inside any LI, ignore
            if (!clickedLi) return;
    
            const selectedFolderId = clickedLi.dataset.folderId;
    
            // Ensure we have a folderId to work with before proceeding
            if (!selectedFolderId) {
                console.warn('Clicked LI has no data-folder-id:', clickedLi);
                return;
            }
    
            // --- Handle Toggle Icon Click ---
            // Check if the click was specifically on a toggle icon within a folder item
            if (target.classList.contains('toggle-icon') && clickedLi.classList.contains('folder-item')) {
                const nestedList = clickedLi.querySelector(':scope > ul.nested-list');
                if (nestedList) {
                    nestedList.classList.toggle('collapsed');
                    target.textContent = nestedList.classList.contains('collapsed') ? '▶' : '▼';
                }
                // Important: Don't proceed to filter/render bookmarks if only toggling expansion
                return;
            }
    
            // --- Handle Folder Selection (including "All Bookmarks") ---
            // This part runs if the click was *not* on a toggle icon, but on the LI content itself
    
            // Get the folder name
            let folderName = "所有书签"; // Default for 'all'
            if (selectedFolderId !== 'all') {
                const folderNameElement = clickedLi.querySelector('.folder-title-text');
                folderName = folderNameElement ? folderNameElement.textContent : clickedLi.textContent.trim(); // Fallback for safety
            } else {
                // Ensure it's actually the 'all' item being processed
                 folderName = clickedLi.textContent.trim(); // Get text directly for 'all'
            }
    
            // --- Update Active State and Parent Highlighting ---
            folderList.querySelectorAll('li').forEach(li => {
                li.classList.remove('active', 'parent-highlight');
                li.style.removeProperty('--parent-depth');
            });
            clickedLi.classList.add('active');
    
            // Apply parent highlighting ONLY if the selected folder is NOT 'all'
            if (selectedFolderId !== 'all') {
                let currentId = selectedFolderId;
                let depth = 1;
                while (currentId && currentId !== 'all') {
                    const folder = folderMap.get(currentId);
                    // Added check for folder existence in map
                    if (!folder || !folder.parentId || folder.parentId === 'all') {
                        break;
                    }
                    const parentId = folder.parentId;
                    const parentLi = folderList.querySelector(`li[data-folder-id="${parentId}"]`);
                    if (parentLi) {
                        parentLi.classList.add('parent-highlight');
                        parentLi.style.setProperty('--parent-depth', depth);
                        depth++;
                    }
                    currentId = parentId;
                }
            }
            // --- End Active State Handling ---
    
            // Update the main content title
            currentFolderTitle.textContent = folderName;
    
            // Filter and display bookmarks based on the selected folder ID
            console.log(`Filtering bookmarks for folderId: "${selectedFolderId}"`);
            const filteredBookmarks = allBookmarksData.filter(item => {
                // Always filter out non-bookmark items first
                if (item.type !== 'bookmark') return false;
    
                // If 'all' is selected, include all bookmarks
                if (selectedFolderId === 'all') {
                    return true;
                }
                // Otherwise, match the bookmark's folderId with the selected one
                return item.folderId === selectedFolderId;
            });
    
            console.log(`Switched to folder: "${folderName}" (${selectedFolderId}), found ${filteredBookmarks.length} bookmarks`);
            renderBookmarks(filteredBookmarks);
    
        }); // --- End of folderList event listener ---

    // --- 5. 处理搜索 ---
    searchBox.addEventListener('input', () => {
        const searchTerm = searchBox.value.toLowerCase();
        const activeFolderId = folderList.querySelector('li.active')?.dataset.folderId || 'all';

        // 根据当前文件夹和搜索词过滤书签
        const filteredBookmarks = allBookmarksData.filter(item => {
            if (item.type !== 'bookmark') return false;

            const folderMatch = (activeFolderId === 'all') || item.folderId === activeFolderId;
            if (!searchTerm) return folderMatch;

            const titleMatch = item.title.toLowerCase().includes(searchTerm);
            const urlMatch = item.url.toLowerCase().includes(searchTerm);

            return folderMatch && (titleMatch || urlMatch);
        });

        console.log(`搜索: "${searchTerm}", 找到 ${filteredBookmarks.length} 个匹配项`);
        renderBookmarks(filteredBookmarks);
    });
});
