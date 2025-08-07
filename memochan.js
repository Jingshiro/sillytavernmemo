(function() {
    const STYLE_ID = 'memo-styles';
    const MODAL_ID = 'memoModal';
    const MODAL_CLASS_NAME = 'memo-modal-dialog';
    const MODAL_CONTENT_CLASS = 'memo-modal-content';
    const MODAL_HEADER_CLASS = 'memo-modal-header';
    const MODAL_TITLE_CLASS = 'memo-modal-title';
    const MODAL_CLOSE_X_CLASS = 'memo-modal-close-x';
    const MODAL_BODY_CLASS = 'memo-modal-body';
    const MODAL_FOOTER_CLASS = 'memo-modal-footer';
    const MENU_BUTTON_ID = 'memoMenuButton';
    const MEMO_INPUT_ID = 'memoInput';
    const MEMO_TITLE_INPUT_ID = 'memoTitleInput';
    const LOCAL_STORAGE_KEY_PREFIX = 'memo_'; // 前缀，后面跟角色-聊天记录标识
    const GITHUB_CONFIG_KEY = 'memo_github_config'; // GitHub配置存储键
    const STYLE_PREFERENCE_KEY = 'memo_style_preference'; // 样式偏好存储键
    const FONT_STORAGE_KEY = 'memo_custom_fonts'; // 自定义字体存储键
    const FONT_PREFERENCE_KEY = 'memo_font_preference'; // 字体偏好存储键
    const CUSTOM_COLOR_CONFIG_KEY = 'memo_custom_color_config'; // 自定义颜色配置存储键
    const SAVED_COLOR_SCHEMES_KEY = 'memo_saved_color_schemes'; // 保存的自定义配色方案存储键
    const LLM_CONFIG_KEY = 'memo_llm_config'; // LLM配置存储键
    
    
    let MemoDoc = document;
    if (window.parent && window.parent.document && window.parent.document !== document) {
      MemoDoc = window.parent.document;
    }
    
    let modalElement = null;
    let modalDialogElement = null;
    let modalTitleElement = null;
    let modalBodyElement = null;
    let modalFooterElement = null;
    let currentChatContext = null;
    let chatChangeListener = null;
    let messageObserver = null;
    
    // 多选模式状态管理
    const selectionState = {
      isMultiSelectMode: false,        // 是否在多选模式
      selectedParagraphs: [],          // 已选段落数组 [{element, text, index, messageId}]
      controlPanel: null               // 控制面板元素
    };
    
    const state = {
      memos: {},
      currentView: 'list',
      editingMemoId: null,
      currentSourceContext: null,  // 当前源上下文信息（用于楼层信息）
      sortBy: 'time',  // 排序方式：'time' | 'floor'
      sortOrder: 'desc',  // 排序顺序：'asc' | 'desc'
      selectedChatContext: null,  // 用户手动选择的聊天上下文
      githubConfig: {
        repo: '',      // 仓库地址，格式：username/repo
        token: '',     // GitHub个人访问令牌
        branch: 'main', // 分支名称
        path: 'memo-data', // 保存数据的文件夹路径
        filename: '',  // 自定义文件名
        lastSync: null  // 上次同步时间
      },
      llmConfig: {
        apiUrl: '',    // LLM API地址
        apiKey: '',    // API密钥
        model: '',     // 选择的模型
        temperature: 0.7, // 温度参数
        availableModels: [], // 可用模型列表
        lastTest: null // 上次测试时间
      },
      fontConfig: {
        customFonts: [],  // 自定义字体列表
        currentFont: 'QiushuiShotai',  // 当前使用的字体
        loadedFonts: new Set()  // 已加载的字体集合
      },
      customColorConfig: {
        color1: '#f8f9ff',  // 渐变起始颜色（左上）
        color2: '#fff5f0',  // 渐变结束颜色（右下）
        fontColor: '#333333',  // 统一字体颜色
        textColors: {       // 文本颜色配置
          userInfo: '#666',
          time: '#999',
          title: '#2c3e50',
          accent: '#4a9eff',
          excerpt: '#34495e',
          notes: '#555',
          brand: '#999',
          decorativeLine: '#4a9eff',
          separatorLine: '#e0e0e0'
        }
      },
      savedColorSchemes: {}, // 保存的自定义配色方案
      // 使用报告相关状态
      currentReportText: '',     // 当前使用报告文本
      currentReportImageUrl: ''  // 当前使用报告长图URL
    };
    
    
    function getUserName() {
        try {
          // 方法1: 使用父窗口的 SillyTavern
          if (window.parent && window.parent.SillyTavern) {
            try {
              const context = window.parent.SillyTavern.getContext();
              if (context && context.name1 && context.name1 !== 'undefined') {
                return context.name1;
              }
            } catch (e) {
              console.log('Memo: SillyTavern.getContext 获取用户名失败', e);
            }
          }
          
          // 方法2: 直接从父窗口获取name1变量
          if (window.parent && window.parent.name1 && window.parent.name1 !== 'undefined') {
            return window.parent.name1;
          }
      
          // 方法3: 从全局变量获取
          if (window.name1 && window.name1 !== 'undefined') {
            return window.name1;
          }
      
          // 方法4: 尝试从父窗口的DOM获取
          if (window.parent && window.parent.document) {
            const messages = window.parent.document.querySelectorAll('#chat .mes');
            for (const msg of messages) {
              const isUser = msg.getAttribute('is_user') === 'true';
              if (isUser) {
                const userName = msg.getAttribute('ch_name');
                if (userName) return userName;
              }
            }
          }
      
          return "User";
        } catch (e) {
          console.error('Memo: 获取用户名失败', e);
          return "User";
        }
      }
    
    
    function getCurrentChatContext() {
      try {
        // 获取当前聊天的实际名称
        const chatName = getCurrentChatName();
        const characterName = getCharacterName();
    
        // 使用 角色名-聊天名 作为上下文
        const context = `${characterName}-${chatName}`;
        return context;
      } catch (e) {
        console.error('Memo: 获取聊天上下文失败', e);
        return 'default_chat';
      }
    }
    
    
    function getMemoStyles() {
      return `
            @keyframes memoFadeIn {
                from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
    
            @keyframes memoItemSlideIn {
                from { opacity: 0; transform: translateX(-10px); }
                to { opacity: 1; transform: translateX(0); }
            }
    
            #${MODAL_ID} {
                display: none; 
                position: fixed;
                z-index: 10000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(5px);
            }
    
            .${MODAL_CLASS_NAME} {
                background: var(--SmartThemeBlurTintColor, #1a1a1c);
                color: var(--SmartThemeBodyColor, #e0e0e0);
                border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 8px 16px rgba(0, 0, 0, 0.2);
                width: 750px;
                max-width: 95vw;
                max-height: 85vh;
                animation: memoFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                position: fixed;
                z-index: 10001;
                box-sizing: border-box;
            }
    
            .${MODAL_HEADER_CLASS} {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 20px 5px 20px;
                border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                flex-shrink: 0;
                background: linear-gradient(135deg, var(--SmartThemeQuoteColor, #4a9eff) 0%, transparent 100%);
                background-size: 100% 2px;
                background-repeat: no-repeat;
                background-position: bottom;
            }
    
            .${MODAL_TITLE_CLASS} {
                margin: 0;
                font-weight: 600;
                font-size: 16px;
                color: var(--SmartThemeBodyColor, #ffffff);
                letter-spacing: 0.5px;
            }
    
            .${MODAL_CLOSE_X_CLASS} {
                background: transparent;
                border: none;
                color: var(--SmartThemeBodyColor, #aaa);
                font-size: 24px;
                font-weight: 300;
                cursor: pointer;
                padding: 8px;
                line-height: 1;
                transition: all 0.2s ease;
                border-radius: 6px;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .${MODAL_CLOSE_X_CLASS}:hover {
                color: var(--SmartThemeBodyColor, #fff);
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.1);
            }
    
            .${MODAL_BODY_CLASS} {
                padding: 24px;
                overflow-y: auto;
                flex-grow: 1;
                text-align: left;
                box-sizing: border-box;
                min-height: 0;
            }
    
            .${MODAL_FOOTER_CLASS} {
                padding: 10px 24px 14px 24px;
                border-top: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                display: flex;
                justify-content: center;
                gap: 12px;
                flex-shrink: 0;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.02));
            }
    
            .memo-button {
                background: var(--SmartThemeQuoteColor, #4a9eff);
                color: var(--SmartThemeBodyColor, #ffffff);
                padding: 6px 16px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                box-shadow: 0 2px 8px rgba(74, 158, 255, 0.2);
                letter-spacing: 0.3px;
            }
            .memo-button:hover {
                background: var(--SmartThemeQuoteColor, #3d8bff);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(74, 158, 255, 0.3);
            }
            .memo-button:active {
                transform: translateY(0);
            }
            .memo-button.danger {
                background:rgb(240, 75, 89);
                box-shadow: 0 2px 8px rgba(255, 71, 87, 0.2);
            }
            .memo-button.danger:hover {
                background:rgb(240, 75, 89);
                box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
            }
            .memo-button.primary {
                background: var(--SmartThemeQuoteColor, #4a9eff);
                box-shadow: 0 2px 8px rgba(74, 158, 255, 0.2);
            }
            .memo-button.primary:hover {
                background: var(--SmartThemeQuoteColor, #3d8bff);
                box-shadow: 0 4px 12px rgba(74, 158, 255, 0.3);
            }
            .memo-button.secondary {
                background: var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                color: var(--SmartThemeBodyColor, #e0e0e0);
                box-shadow: none;
            }
            .memo-button.secondary:hover {
                background: rgba(255, 255, 255, 0.15);
                box-shadow: 0 2px 8px rgba(255, 255, 255, 0.1);
            }
    
            .memo-list-container {
                max-height: 450px;
                overflow-y: auto;
                margin-top: 16px;
                padding-right: 4px;
            }
    
            .memo-list-container::-webkit-scrollbar {
                width: 6px;
            }
    
            .memo-list-container::-webkit-scrollbar-track {
                background: transparent;
            }
    
            .memo-list-container::-webkit-scrollbar-thumb {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3));
                border-radius: 3px;
            }
    
            .memo-list-container::-webkit-scrollbar-thumb:hover {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.5));
            }
    
            .memo-item {
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                border-radius: 12px;
                padding: 6px 8px;
                margin-bottom: 4px;
                transition: all 0.3s ease;
                animation: memoItemSlideIn 0.3s ease-out;
                position: relative;
                overflow: hidden;
                cursor: pointer;
            }
    
            .memo-item::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 4px;
                height: 100%;
                background: var(--SmartThemeQuoteColor, #4a9eff);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
    
            .memo-item:hover {
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08));
                border-color: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3));
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            }
    
            .memo-item:hover::before {
                opacity: 1;
            }
    
            .memo-item:active {
                transform: translateY(0);
            }
    
            .memo-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1px;
                gap: 8px;
            }
    
            .memo-item-title {
                font-weight: 600;
                font-size: 14px;
                color: var(--SmartThemeBodyColor, #ffffff);
                margin: 0;
                line-height: 1.3;
                flex: 1;
            }
    
            .memo-item-date {
                font-size: 10px;
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.6));
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                padding: 3px 6px;
                border-radius: 4px;
                white-space: nowrap;
                font-weight: 500;
            }
    
            .memo-item-content {
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.85));
                line-height: 1.4;
                margin-bottom: 3px;
                font-size: 12px;
                white-space: pre-line;
                word-wrap: break-word;
                word-break: break-word;
            }
    
            .memo-item-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
                margin-top: 2px;
            }
    
            .memo-action-button {
                background: var(--SmartThemeQuoteColor, #4a9eff);
                color: var(--SmartThemeBodyColor, #ffffff);
                border: none;
                padding: 4px 8px;
                font-size: 11px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
                box-shadow: 0 2px 6px rgba(74, 158, 255, 0.2);
            }
            .memo-action-button:hover {
                background: var(--SmartThemeQuoteColor, #3d8bff);
                transform: translateY(-1px);
                box-shadow: 0 4px 10px rgba(74, 158, 255, 0.3);
            }
            .memo-action-button.delete {
                background:rgb(240, 75, 89);
                color: var(--SmartThemeBodyColor, #ffffff);
                border: none;
                box-shadow: 0 2px 6px rgba(255, 71, 87, 0.2);
            }
            .memo-action-button.delete:hover {
                background:rgb(240, 75, 89);
                box-shadow: 0 4px 10px rgba(255, 71, 87, 0.3);
            }
            .memo-action-button.primary {
                background: var(--SmartThemeQuoteColor, #4a9eff);
                color: var(--SmartThemeBodyColor, #ffffff);
                box-shadow: 0 2px 6px rgba(74, 158, 255, 0.2);
            }
            .memo-action-button.primary:hover {
                background: var(--SmartThemeQuoteColor, #3d8bff);
                box-shadow: 0 4px 10px rgba(74, 158, 255, 0.3);
            }
    
            .memo-form {
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-top: 10px;
            }
    
            .memo-form-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
    
            .memo-form-label {
                font-weight: 600;
                color: var(--SmartThemeBodyColor, #ffffff);
                font-size: 14px;
                letter-spacing: 0.3px;
            }
    
            #${MEMO_TITLE_INPUT_ID} {
                padding: 12px 16px;
                border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                border-radius: 10px;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                color: var(--SmartThemeBodyColor, #ffffff);
                font-size: 14px;
                transition: all 0.3s ease;
                font-weight: 500;
            }
    
            #${MEMO_TITLE_INPUT_ID}:focus {
                outline: none;
                border-color: var(--SmartThemeQuoteColor, #4a9eff);
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08));
                box-shadow: 0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
            }
    
            #${MEMO_INPUT_ID} {
                padding: 12px 16px;
                border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                border-radius: 10px;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                color: var(--SmartThemeBodyColor, #ffffff);
                min-height: 140px;
                resize: vertical;
                font-family: inherit;
                font-size: 14px;
                line-height: 1.6;
                transition: all 0.3s ease;
            }
    
            #${MEMO_INPUT_ID}:focus {
                outline: none;
                border-color: var(--SmartThemeQuoteColor, #4a9eff);
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08));
                box-shadow: 0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
            }
    
            .memo-chat-info {
                background: linear-gradient(135deg, var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.1)) 0%, var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05)) 100%);
                border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
                padding: 10px 16px;
                border-radius: 12px;
                margin-bottom: 12px;
                font-size: 14px;
                color: var(--SmartThemeBodyColor, #ffffff);
                text-align: center;
                font-weight: 500;
                letter-spacing: 0.3px;
                cursor: pointer;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                z-index: 9990;
            }
            
            .memo-chat-info:hover {
                background: linear-gradient(135deg, var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.15)) 0%, var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08)) 100%);
                border-color: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3));
                transform: translateY(-1px);
                box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
                z-index: 9990;
            }
            
            .memo-chat-info:after {
                content: "▼";
                font-size: 10px;
                margin-left: 8px;
                opacity: 0.7;
                transition: transform 0.3s ease;
            }
            
            .memo-chat-info.active:after {
                transform: rotate(180deg);
            }
            
            .memo-chat-dropdown {
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                background: var(--SmartThemeBlurTintColor, rgba(30, 30, 32, 0.95));
                border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                border-radius: 8px;
                margin-top: 5px;
                max-height: 0;
                overflow: hidden;
                opacity: 0;
                transition: all 0.3s ease;
                z-index: 10002;
                backdrop-filter: blur(10px);
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            }
            
            .memo-chat-dropdown.show {
                max-height: 300px;
                opacity: 1;
                overflow-y: auto;
            }
            
            /* 确保下拉菜单在显示时的z-index更高 */
            #memoChatSelector.active {
                z-index: 10002;
            }
            
            #memoChatSelector.active .memo-chat-dropdown {
                z-index: 10002;
            }
            
            .memo-chat-dropdown-item {
                padding: 8px 16px;
                border-bottom: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.05));
                cursor: pointer;
                font-size: 13px;
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8));
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .memo-chat-dropdown-item:hover {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.1));
            }
            
            .memo-chat-dropdown-item.active {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
                color: var(--SmartThemeBodyColor, #ffffff);
                font-weight: 600;
            }
            
            .memo-chat-dropdown-item-count {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
                color: var(--SmartThemeBodyColor, #ffffff);
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 10px;
                font-weight: 600;
                min-width: 20px;
                text-align: center;
            }
            
            /* 调整筛选控制器的z-index */
            .memo-filter-container {
                position: relative;
                z-index: 9980;
            }
            
            /* 确保筛选按钮不会覆盖下拉菜单 */
            .memo-filter-buttons {
                position: relative;
                z-index: 9980;
            }
    
            .memo-filter-btn {
                position: relative;
                z-index: 9980;
            }
            
            .memo-order-btn {
                position: relative;
                z-index: 9980;
            }
    
            .empty-memo-message {
                text-align: center;
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.6));
                padding: 60px 20px;
                font-style: italic;
                font-size: 16px;
            }
    
            .empty-memo-message p:first-child {
                font-size: 18px;
                margin-bottom: 8px;
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8));
            }
    
            /* 响应式设计 */
            @media (max-width: 768px) {
                .${MODAL_CLASS_NAME} {
                    width: 95vw;
                    max-height: 90vh;
                    border-radius: 12px;
                }
                .${MODAL_BODY_CLASS} {
                    padding: 16px 12px;
                }
                .${MODAL_FOOTER_CLASS} {
                    padding: 10px 16px 14px 16px;
                    flex-direction: column;
                    gap: 8px;
                }
                .memo-button {
                    width: 100%;
                    justify-content: center;
                }
                .memo-item {
                    padding: 6px 8px;
                }
                .memo-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 1px;
                }
                .memo-item-title {
                    font-size: 13px;
                }
                .memo-item-date {
                    align-self: flex-end;
                }
                .memo-item-content {
                    margin-bottom: 3px;
                    font-size: 11px;
                }
                .memo-item-actions {
                    justify-content: center;
                    gap: 8px;
                    margin-top: 2px;
                }
                .memo-action-button {
                    flex: 1;
                    text-align: center;
                    padding: 3px 6px;
                    font-size: 10px;
                }
                
                /* 确保筛选控制器在小屏幕也保持水平布局 */
                .memo-filter-container {
                    flex-wrap: nowrap !important;
                }
            }
    
            /* 段落注释按钮样式 */
            .memo-annotation-btn {
                position: absolute;
                top: -10px;
                right: -2px;
                width: 18px;
                height: 18px;
                border: none;
                border-radius: 3px;
                background: transparent;
                color: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.6));
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                opacity: 0;
                transition: all 0.2s ease;
                z-index: 100;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: none;
                line-height: 1;
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            }
    
            .memo-annotation-btn:hover {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.1));
                color: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 1));
                transform: scale(1.2);
                box-shadow: 0 2px 8px rgba(74, 158, 255, 0.3);
            }
    
            .memo-annotation-btn:active {
                background: transparent;
                color: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 1));
                transform: scale(1.1);
                box-shadow: none;
            }
    
            .mes_text p:hover .memo-annotation-btn,
            .message_text p:hover .memo-annotation-btn,
            .mes_text div:hover .memo-annotation-btn {
                opacity: 1;
            }
    
            .mes_text p {
                position: relative;
            }
    
            .message_text p {
                position: relative;
            }
    
            .mes_text div {
                position: relative;
            }
    
            /* 移动端适配 */
            @media (max-width: 768px) {
                .memo-annotation-btn {
                    opacity: 0.7;
                    width: 20px;
                    height: 20px;
                    font-size: 12px;
                    right: 8px;
                }
            }
    
            /* 多选控制面板样式 */
            .memo-control-panel {
                position: fixed !important;
                bottom: 100px !important;
                left: 50% !important;
                width: 220px !important;
                margin-left: -110px !important;
                transform: none !important;
                z-index: 9999 !important;
                display: flex !important;
                gap: 6px;
                background: var(--SmartThemeBlurTintColor, rgba(0, 0, 0, 0.4)) !important;
                padding: 6px 10px;
                border-radius: 12px;
                border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.15));
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(16px);
                min-height: 40px;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                animation: none !important;
                transition: none !important;
                top: auto !important;
            }
    
            .memo-control-btn {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.7));
                color: var(--SmartThemeBodyColor, #ffffff);
                border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.4));
                padding: 4px 10px;
                font-size: 12px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(74, 158, 255, 0.15);
                backdrop-filter: blur(8px);
                transition: none !important;
                animation: none !important;
            }
    
            .memo-control-btn.secondary {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3));
                color: var(--SmartThemeBodyColor, #ffffff);
                border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.5));
                box-shadow: 0 2px 8px rgba(74, 158, 255, 0.1);
            }
    
            .memo-control-btn:disabled {
                background: rgba(255, 255, 255, 0.05);
                color: rgba(255, 255, 255, 0.4);
                border-color: rgba(255, 255, 255, 0.1);
                cursor: not-allowed;
                box-shadow: none;
            }
    
            /* 多选模式下的段落样式 */
            .memo-multi-select-mode .memo-annotation-btn {
                font-size: 14px;
                width: 20px;
                height: 20px;
                border: 2px solid var(--SmartThemeQuoteColor, #4a9eff);
                border-radius: 4px;
                background: transparent;
                color: var(--SmartThemeQuoteColor, #4a9eff);
                display: flex;
                align-items: center;
                justify-content: center;
            }
    
            .memo-multi-select-mode .memo-annotation-btn.selected {
                background: var(--SmartThemeQuoteColor, #4a9eff);
                color: var(--SmartThemeBodyColor, #ffffff);
            }
    
            /* 选中段落的背景高亮 */
            .memo-paragraph-selected {
                border: 2px solid var(--SmartThemeQuoteColor, #4a9eff) !important;
                border-radius: 6px !important;
                padding: 4px !important;
                margin: 2px 0 !important;
                transition: all 0.2s ease !important;
                box-shadow: 0 0 8px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3)) !important;
            }
    
            /* 样式选择器美化 */
            #memoStyleSelector {
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                background-image: url("data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6,9 12,15 18,9'></polyline></svg>");
                background-repeat: no-repeat;
                background-position: right 8px center;
                background-size: 16px;
                padding-right: 32px !important;
            }
    
            #memoStyleSelector:focus {
                outline: none;
                border-color: var(--SmartThemeQuoteColor, #4a9eff) !important;
                background-color: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08)) !important;
                box-shadow: 0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2)) !important;
            }
    
            #memoStyleSelector option {
                background: var(--SmartThemeBlurTintColor, #2a2a2a);
                color: var(--SmartThemeBodyColor, #ffffff);
                padding: 8px;
            }
    
            /* 图片预览容器样式 */
            #imagePreviewContainer {
                transition: all 0.3s ease;
            }
    
            #imagePreviewContainer:hover {
                border-color: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3)) !important;
            }
    
            /* 加载指示器动画 */
            #imageLoadingIndicator {
                animation: memoLoadingPulse 1.5s ease-in-out infinite;
            }
    
            @keyframes memoLoadingPulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
    
            /* 筛选控制器样式 */
            .memo-filter-container {
                transition: all 0.3s ease;
            }
    
            .memo-filter-container:hover {
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05)) !important;
                border-color: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2)) !important;
            }
    
            .memo-filter-buttons {
                display: flex;
                gap: 2px;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                padding: 2px;
                border-radius: 6px;
                border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
            }
    
            .memo-filter-btn {
                background: transparent;
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
                border: none;
                padding: 3px 8px;
                font-size: 11px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 500;
                position: relative;
                overflow: hidden;
                white-space: nowrap;
            }
    
            .memo-filter-btn:hover {
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.9));
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.1));
            }
    
            .memo-filter-btn.active {
                background: var(--SmartThemeQuoteColor, #4a9eff);
                color: var(--SmartThemeBodyColor, #ffffff);
                box-shadow: 0 2px 8px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3));
            }
    
            .memo-filter-btn.active:hover {
                background: var(--SmartThemeQuoteColor, #3d8bff);
                color: var(--SmartThemeBodyColor, #ffffff);
            }
    
            .memo-order-btn {
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
                border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                padding: 4px 6px;
                font-size: 12px;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.2s ease;
                font-weight: 600;
                min-width: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
    
            .memo-order-btn:hover {
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.9));
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.1));
                border-color: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3));
                transform: translateY(-1px);
            }
    
            .memo-order-btn.active {
                background: var(--SmartThemeQuoteColor, #4a9eff);
                color: var(--SmartThemeBodyColor, #ffffff);
                border-color: var(--SmartThemeQuoteColor, #4a9eff);
                box-shadow: 0 2px 8px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3));
            }
    
            .memo-order-btn.active:hover {
                background: var(--SmartThemeQuoteColor, #3d8bff);
                border-color: var(--SmartThemeQuoteColor, #3d8bff);
                transform: translateY(-1px);
            }
            
            /* GitHub设置按钮样式 */
            #memoSettingsBtn {
                display: inline-block;
                background: transparent;
                border: none;
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8));
                font-size: 18px;
                cursor: pointer;
                margin-left: 4px;
                transition: all 0.2s ease;
                position: relative;
                top: 0px;
                line-height: 1;
            }
            
            #memoSettingsBtn:hover {
                color: var(--SmartThemeQuoteColor, #4a9eff);
                transform: rotate(30deg);
            }
    
            .memo-copy-button {
                position: absolute;
                top: 8px;
                right: 8px;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.1));
                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
                border: none;
                padding: 4px;
                font-size: 12px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.7;
                z-index: 10002;
            }
            
            .memo-textarea-container:hover .memo-copy-button {
                opacity: 1;
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
            }
            
            .memo-copy-button:hover {
                background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3)) !important;
                color: var(--SmartThemeBodyColor, #ffffff);
                transform: scale(1.1);
            }
            
            .memo-copy-button:active {
                transform: scale(0.95);
            }
            
            /* 确保textarea相对于container定位 */
            .memo-textarea-container textarea {
                width: 100%;
                box-sizing: border-box;
                position: relative;
            }
            
            /* 修复Font Awesome图标 */
            .memo-copy-button i {
                font-size: 14px;
                line-height: 1;
            }
    
            .memo-textarea-container {
                position: relative;
                width: 100%;
            }
        `;
    }
    
    
    
    function getCurrentChatName() {
      try {
        // 方法1: 使用父窗口的 SillyTavern
        if (window.parent && window.parent.SillyTavern) {
          try {
            const context = window.parent.SillyTavern.getContext();
            if (context && context.chatId && context.chatId !== 'undefined') {
              return context.chatId;
            }
            if (context && context.chatMetadata && context.chatMetadata.filename) {
              const filename = context.chatMetadata.filename.replace(/\.(jsonl?|txt)$/i, '');
              if (filename && filename !== 'undefined') {
                return filename;
              }
            }
          } catch (e) {
            // SillyTavern.getContext 调用失败，继续使用其他方法
            console.log('Memo: SillyTavern.getContext 获取聊天名失败', e);
          }
        }
    
        // 方法2: 从聊天文件名获取
        if (window.chat_metadata && window.chat_metadata.filename) {
          const filename = window.chat_metadata.filename.replace(/\.(jsonl?|txt)$/i, '');
          if (filename && filename !== 'undefined') {
            return filename;
          }
        }
    
        // 方法3: 从全局变量获取
        if (window.selected_button && window.selected_button !== 'undefined') {
          return window.selected_button;
        }
    
        // 方法4: 从DOM元素获取聊天标题
        const chatTitleSelectors = [
          '#chat_filename',
          '.chat-title',
          '.selected_chat',
          '[data-chat-name]',
          '.chat_select option:checked',
          '#selected_chat_pole'
        ];
    
        for (const selector of chatTitleSelectors) {
          const element = MemoDoc.querySelector(selector);
          if (element) {
            const chatName = element.textContent?.trim() || element.value?.trim() || element.getAttribute('data-chat-name');
            if (chatName && chatName !== 'undefined' && chatName !== '') {
              return chatName;
            }
          }
        }
    
        // 方法5: 从URL参数获取
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('chat')) {
          return urlParams.get('chat');
        }
    
        // 默认聊天名
        return 'default_chat';
      } catch (e) {
        console.error('Memo: 获取聊天名失败', e);
        return 'default_chat';
      }
    }
    
    function getCharacterName() {
      try {
        // 方法1: 使用父窗口的 TavernHelper
        if (window.parent && window.parent.TavernHelper && window.parent.TavernHelper.getCharData) {
          try {
            const charData = window.parent.TavernHelper.getCharData();
            if (charData && charData.name) {
              return charData.name;
            }
          } catch (e) {
            // TavernHelper调用失败，继续使用其他方法
            console.log('Memo: TavernHelper.getCharData 调用失败', e);
          }
        }
    
        // 方法2: 使用父窗口的 SillyTavern
        if (window.parent && window.parent.SillyTavern) {
          try {
            const context = window.parent.SillyTavern.getContext();
            if (context && context.name2 && context.name2 !== 'undefined') {
              return context.name2;
            }
          } catch (e) {
            // SillyTavern.getContext 调用失败，继续使用其他方法
            console.log('Memo: SillyTavern.getContext 调用失败', e);
          }
        }
    
        // 方法3: 从全局变量获取
        if (window.name2 && window.name2 !== 'undefined') {
          return window.name2;
        }
    
        // 方法4: 从DOM获取
        const characterNameElement = MemoDoc.querySelector('#character_name_pole, .character_name, [data-character-name]');
        if (characterNameElement) {
          const charName = characterNameElement.textContent?.trim() || characterNameElement.getAttribute('data-character-name');
          if (charName && charName !== 'undefined') {
            return charName;
          }
        }
    
        // 方法5: 从URL参数获取
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('character')) {
          return urlParams.get('character');
        }
    
        return 'unknown_character';
      } catch (e) {
        console.error('Memo: 获取角色名失败', e);
        return 'unknown_character';
      }
    }
    
    function getStorageKey(context) {
      return `${LOCAL_STORAGE_KEY_PREFIX}${context}`;
    }
    
    function saveMemosToStorage(context, memos) {
      try {
        const key = getStorageKey(context);
        localStorage.setItem(key, JSON.stringify(memos));
      } catch (e) {
        console.error('Memo: 保存Memo失败:', e);
        toastr.error('保存失败: ' + e.message);
      }
    }
    
    function loadMemosFromStorage(context) {
      try {
        const key = getStorageKey(context);
        const stored = localStorage.getItem(key);
        if (stored) {
          return JSON.parse(stored);
        }
        return [];
      } catch (e) {
        console.error('Memo: 加载Memo失败:', e);
        return [];
      }
    }
    
    
    function injectStyles() {
      if (!MemoDoc.getElementById(STYLE_ID)) {
        const style = MemoDoc.createElement('style');
        style.id = STYLE_ID;
        style.textContent = getMemoStyles();
        MemoDoc.head.appendChild(style);
      }
    }
    
    function ensureModalStructure() {
      if (!modalElement) {
        modalElement = MemoDoc.createElement('div');
        modalElement.id = MODAL_ID;
        modalElement.innerHTML = `
                <div class="${MODAL_CLASS_NAME}">
                    <div class="${MODAL_HEADER_CLASS}">
                        <h3 class="${MODAL_TITLE_CLASS}">Memo管理</h3>
                        <div style="display: flex; align-items: center;">
                            <button id="memoClearAllBtn" class="memo-clear-all-btn" title="清除所有Memo" style="
                                background: transparent;
                                border: none;
                                color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
                                font-size: 16px;
                                cursor: pointer;
                                padding: 8px;
                                margin-right: 5px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: all 0.2s ease;
                            "><i class="fas fa-broom"></i></button>
                            <button class="${MODAL_CLOSE_X_CLASS}">&times;</button>
                        </div>
                    </div>
                    <div class="${MODAL_BODY_CLASS}"></div>
                    <div class="${MODAL_FOOTER_CLASS}"></div>
                </div>
            `;
        MemoDoc.body.appendChild(modalElement);
    
        modalDialogElement = modalElement.querySelector(`.${MODAL_CLASS_NAME}`);
        modalTitleElement = modalElement.querySelector(`.${MODAL_TITLE_CLASS}`);
        modalBodyElement = modalElement.querySelector(`.${MODAL_BODY_CLASS}`);
        modalFooterElement = modalElement.querySelector(`.${MODAL_FOOTER_CLASS}`);
    
        // 绑定关闭按钮事件
        const closeButton = modalElement.querySelector(`.${MODAL_CLOSE_X_CLASS}`);
        if (closeButton) {
          closeButton.addEventListener('click', closeMemoModal);
        }
    
        // 绑定清除所有按钮事件
        const clearAllButton = modalElement.querySelector('#memoClearAllBtn');
        if (clearAllButton) {
          clearAllButton.addEventListener('click', clearAllLocalMemos);
    
          // 添加悬停效果
          clearAllButton.addEventListener('mouseover', function () {
            this.style.color = 'var(--SmartThemeQuoteColor, #4a9eff)';
            this.style.transform = 'scale(1.1)';
          });
    
          clearAllButton.addEventListener('mouseout', function () {
            this.style.color = 'var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7))';
            this.style.transform = 'scale(1)';
          });
        }
    
        // 点击背景关闭模态框
        modalElement.addEventListener('click', (e) => {
          if (e.target === modalElement) {
            closeMemoModal();
          }
        });
      }
    }
    
    function createButton(text, className, onClick) {
      const button = MemoDoc.createElement('button');
      button.textContent = text;
      button.className = `memo-button ${className || ''}`;
      button.onclick = onClick;
      return button;
    }
    
    function renderMemoList() {
      // 设置当前视图状态
      state.currentView = 'list';
    
      // 清理源上下文信息
      state.currentSourceContext = null;
    
      // 每次渲染时都重新获取当前聊天上下文
      const newChatContext = getCurrentChatContext();
    
      // 如果聊天上下文发生了变化且没有手动选择的上下文，更新当前上下文
      if (currentChatContext !== newChatContext && !state.selectedChatContext) {
        currentChatContext = newChatContext;
      }
    
      // 确定要显示的聊天上下文 - 优先使用手动选择的上下文
      const displayContext = state.selectedChatContext || currentChatContext;
    
      // 加载对应上下文的Memo数据
      const memos = loadMemosFromStorage(displayContext);
    
      // 根据当前排序设置进行排序
      sortMemos(memos);
    
      // 设置标题并添加齿轮图标（只在列表视图）
      if (state.currentView === 'list') {
        // 创建标题文本和按钮的容器
        modalTitleElement.innerHTML = '';
    
        // 创建标题文本节点
        const titleText = MemoDoc.createTextNode('Memo');
        modalTitleElement.appendChild(titleText);
    
        // 创建设置按钮（内联显示）
        const settingsBtn = MemoDoc.createElement('span');
        settingsBtn.id = 'memoSettingsBtn';
        settingsBtn.title = 'GitHub同步设置';
        settingsBtn.innerHTML = '۞';
        settingsBtn.style.cssText = `
          display: inline-block;
          background: transparent;
          border: none;
          color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8));
          font-size: 18px;
          cursor: pointer;
          margin-left: 6px;
          transition: all 0.2s ease;
          position: relative;
          top: 0px;
          line-height: 1;
        `;
    
        settingsBtn.addEventListener('mouseover', function () {
          this.style.color = 'var(--SmartThemeQuoteColor, #4a9eff)';
          this.style.transform = 'rotate(30deg)';
        });
    
        settingsBtn.addEventListener('mouseout', function () {
          this.style.color = 'var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8))';
          this.style.transform = 'rotate(0deg)';
        });
    
        settingsBtn.addEventListener('click', function () {
          renderGitHubSettings();
        });
    
        // 直接跟在文本后面添加按钮
        modalTitleElement.appendChild(settingsBtn);
      } else {
        // 其他视图只显示标题文本
        modalTitleElement.textContent = 'Memo';
      }
    
      // 显示当前聊天信息
      let characterName = 'Unknown Character';
      let chatName = 'Unknown Chat';
    
      if (displayContext) {
        // 从displayContext中提取角色名和聊天名
        const parts = displayContext.split('-');
        if (parts.length >= 2) {
          characterName = parts[0].trim();
          chatName = parts.slice(1).join('-').trim();
        } else {
          characterName = 'Unknown Character';
          chatName = displayContext;
        }
      } else {
        // 如果没有displayContext，尝试从TavernHelper或其他方法获取
        if (window.TavernHelper && window.TavernHelper.substitudeMacros) {
          try {
            characterName = window.TavernHelper.substitudeMacros('{{char}}') || 'Unknown Character';
            // 尝试获取聊天名，可能的宏包括这些
            const possibleChatMacros = ['{{chatName}}', '{{chat_name}}', '{{filename}}', '{{chat}}'];
            for (const macro of possibleChatMacros) {
              const result = window.TavernHelper.substitudeMacros(macro);
              if (result && result !== macro) { // 如果宏被成功替换了
                chatName = result;
                break;
              }
            }
            // 如果上面的宏都没用，尝试传统方法
            if (chatName === 'Unknown Chat') {
              chatName = getCurrentChatName();
            }
          } catch (e) {
            characterName = getCharacterName();
            chatName = getCurrentChatName();
          }
        } else {
          // 如果没有 TavernHelper，使用传统方法
          characterName = getCharacterName();
          chatName = getCurrentChatName();
        }
      }
    
      // 获取所有聊天的Memo数据
      const allChats = getAllMemoChats();
    
      let html = `
            <div class="memo-chat-info" id="memoChatSelector">
                ${escapeHtml(characterName)} - ${escapeHtml(chatName)}
                <div class="memo-chat-dropdown" id="memoChatDropdown">
                    ${allChats.map(chat => {
        const isActive = chat.context === displayContext;
        return `
                        <div class="memo-chat-dropdown-item ${isActive ? 'active' : ''}" data-chat-key="${chat.key}" data-chat-context="${chat.context}">
                            <span>${escapeHtml(chat.name)}</span>
                            <span class="memo-chat-dropdown-item-count">${chat.count}</span>
                        </div>
                      `;
      }).join('')}
                </div>
            </div>
            
            <!-- 筛选控制器 -->
            <div class="memo-filter-container" style="
                margin-bottom: 16px;
                padding: 8px 12px;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.03));
                border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                flex-wrap: nowrap;
            ">
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <span style="
                        font-size: 11px;
                        color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8));
                        font-weight: 500;
                        white-space: nowrap;
                    ">排序：</span>
                    <div class="memo-filter-buttons">
                        <button class="memo-filter-btn ${state.sortBy === 'time' ? 'active' : ''}" data-sort="time">
                            时间
                        </button>
                        <button class="memo-filter-btn ${state.sortBy === 'floor' ? 'active' : ''}" data-sort="floor">
                            楼层
                        </button>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <span style="
                        font-size: 11px;
                        color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8));
                        font-weight: 500;
                        white-space: nowrap;
                    ">顺序：</span>
                    <button class="memo-order-btn ${state.sortOrder === 'desc' ? 'active' : ''}" data-order="desc" title="${state.sortBy === 'time' ? '最新在前' : '楼层号大在前'}">
                        ↓
                    </button>
                    <button class="memo-order-btn ${state.sortOrder === 'asc' ? 'active' : ''}" data-order="asc" title="${state.sortBy === 'time' ? '最旧在前' : '楼层号小在前'}">
                        ↑
                    </button>
                </div>
            </div>
        `;
    
      if (memos.length === 0) {
        html += `
                <div class="empty-memo-message">
                    <p>暂无Memo</p>
                    <p>点击"新建"开始记录吧！</p>
                </div>
            `;
      } else {
        html += '<div class="memo-list-container">';
        memos.forEach((memo) => {
          // 使用 getDisplayTitle 获取显示标题
          const displayTitle = getDisplayTitle(memo);
          // 显示最后编辑时间，如果没有则显示创建时间
          const lastEditTime = memo.updatedAt || memo.createdAt;
          const date = new Date(lastEditTime).toLocaleString('zh-CN');
    
          // 生成楼层信息显示
          const floorInfo = memo.floorLabel || (memo.type === 'annotation' ? '未知楼层' : '');
    
          // 生成Memo项HTML
          html += `
                    <div class="memo-item" data-memo-id="${memo.id}">
                        <div class="memo-item-header">
                            <h4 class="memo-item-title">${escapeHtml(displayTitle)}</h4>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${floorInfo ? `<span class="memo-item-floor" style="
                                    font-size: 10px;
                                    color: #ffffff;
                                    background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.1));
                                    padding: 2px 6px;
                                    border-radius: 3px;
                                    white-space: nowrap;
                                    font-weight: 500;
                                    border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
                                ">${escapeHtml(floorInfo)}</span>` : ''}
                            <span class="memo-item-date">${date}</span>
                            </div>
                        </div>
                        ${memo.type === 'annotation' && memo.originalText ? `
                        <div class="memo-item-content">
                            ${escapeHtml(memo.content.length > 50 ? memo.content.substring(0, 50) + '...' : memo.content)}
                        </div>
                        ` : `
                        <div class="memo-item-content">
                            ${escapeHtml(memo.content.length > 50 ? memo.content.substring(0, 50) + '...' : memo.content)}
                        </div>
                        `}
                        <div class="memo-item-actions">
                            ${memo.type === 'annotation' && memo.originalText ? `
                            <button class="memo-action-button primary" data-memo-id="${memo.id}" data-action="share">分享</button>
                            ` : ''}
                            <button class="memo-action-button delete" data-memo-id="${memo.id}" data-action="delete">删除</button>
                        </div>
                    </div>
                `;
        });
        html += '</div>';
      }
    
      modalBodyElement.innerHTML = html;
    
      // 绑定聊天选择器点击事件
      const chatSelector = modalBodyElement.querySelector('#memoChatSelector');
      const chatDropdown = modalBodyElement.querySelector('#memoChatDropdown');
    
      if (chatSelector && chatDropdown) {
        // 点击选择器显示/隐藏下拉菜单
        chatSelector.addEventListener('click', function (e) {
          e.stopPropagation(); // 阻止冒泡
    
          // 切换active类
          this.classList.toggle('active');
          chatDropdown.classList.toggle('show');
    
          // 如果下拉菜单显示，确保它在最上层
          if (chatDropdown.classList.contains('show')) {
            // 添加一个临时的高z-index
            chatDropdown.style.zIndex = '10002';
            this.style.zIndex = '10000';
          } else {
            // 恢复默认z-index
            setTimeout(() => {
              chatDropdown.style.zIndex = '';
              this.style.zIndex = '';
            }, 300); // 等待过渡动画完成
          }
        });
    
        // 点击下拉菜单项切换聊天
        const dropdownItems = chatDropdown.querySelectorAll('.memo-chat-dropdown-item');
        dropdownItems.forEach(item => {
          item.addEventListener('click', function (e) {
            e.stopPropagation(); // 阻止冒泡，防止触发chatSelector的点击事件
            const chatContext = this.getAttribute('data-chat-context');
            if (chatContext) {
              // 更新手动选择的聊天上下文
              state.selectedChatContext = chatContext;
    
              // 重新渲染列表
              renderMemoList();
    
              // 关闭下拉菜单
              chatSelector.classList.remove('active');
              chatDropdown.classList.remove('show');
    
              // 恢复默认z-index
              setTimeout(() => {
                chatDropdown.style.zIndex = '';
                chatSelector.style.zIndex = '';
              }, 300); // 等待过渡动画完成
    
              // 显示切换成功提示
              if (typeof toastr !== 'undefined') {
                toastr.success(`已切换到 ${chatContext.replace('-', ' - ')} 的Memo记录`);
              }
            }
          });
        });
    
        // 点击其他区域关闭下拉菜单
        document.addEventListener('click', function () {
          chatSelector.classList.remove('active');
          chatDropdown.classList.remove('show');
    
          // 恢复默认z-index
          setTimeout(() => {
            if (chatDropdown) chatDropdown.style.zIndex = '';
            if (chatSelector) chatSelector.style.zIndex = '';
          }, 300); // 等待过渡动画完成
        });
      }
    
      // 绑定筛选控制器事件（无论是否有Memo都需要绑定）
      bindFilterEvents();
    
      // 绑定Memo操作按钮事件（只有在有Memo时才绑定）
      if (memos.length > 0) {
        bindMemoActionEvents();
      }
    
      // 渲染所有按钮到一个统一的行
      modalFooterElement.innerHTML = '';
    
      // 创建单行按钮容器
      const buttonContainer = MemoDoc.createElement('div');
      buttonContainer.style.display = 'flex';
      buttonContainer.style.width = '100%';
      buttonContainer.style.justifyContent = 'center';
      buttonContainer.style.gap = '10px';
    
      // 创建统一的按钮样式函数
      const createUniformButton = (text, className, onClick) => {
        const button = MemoDoc.createElement('button');
        button.className = `memo-button ${className || ''}`;
        button.textContent = text;
        button.onclick = onClick;
    
        // 统一的按钮样式，确保相同大小
        button.style.flex = '1';
        button.style.maxWidth = '80px';
        button.style.fontSize = '14px';
        button.style.padding = '8px 0';
        button.style.borderRadius = '6px';
        button.style.textAlign = 'center';
        button.style.whiteSpace = 'nowrap';
    
        return button;
      };
    
      // 创建四个按钮
      const newButton = createUniformButton('新建', 'primary', () => renderCreateMemo());
      const importButton = createUniformButton('导入', 'secondary', () => {
        const fileSelector = createFileSelector();
        fileSelector.click();
      });
      const exportButton = createUniformButton('导出', 'secondary', () => exportAllMemos());
      const yearlyReportButton = createUniformButton('使用报告', 'secondary', () => renderYearlyReportGenerator());
      const deleteButton = createUniformButton('删除', 'danger', () => clearCurrentChatMemos());
    
      // 添加所有按钮到容器
      buttonContainer.appendChild(newButton);
      buttonContainer.appendChild(importButton);
      buttonContainer.appendChild(exportButton);
      buttonContainer.appendChild(yearlyReportButton);
      buttonContainer.appendChild(deleteButton);
    
      // 添加按钮容器到页脚
      modalFooterElement.appendChild(buttonContainer);
    
      // 重新居中模态框
      requestAnimationFrame(() => {
        centerModal();
      });
    }
    
    // 添加获取所有Memo聊天的函数
    function getAllMemoChats() {
      const chats = [];
    
      // 遍历localStorage中所有以memo_开头的键
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX) && key !== GITHUB_CONFIG_KEY) {
          try {
            // 从键名中提取聊天上下文
            const contextPart = key.substring(LOCAL_STORAGE_KEY_PREFIX.length);
    
            // 尝试解析数据以获取条目数量
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            const count = Array.isArray(data) ? data.length : 0;
    
            // 只添加有memo记录的聊天
            if (count > 0) {
              // 提取角色名和聊天名
              let displayName = contextPart;
              const parts = contextPart.split('-');
              if (parts.length >= 2) {
                const charName = parts[0].trim();
                const chatName = parts.slice(1).join('-').trim();
                displayName = `${charName} - ${chatName}`;
              }
    
              chats.push({
                key: key,
                context: contextPart,
                name: displayName,
                count: count
              });
            }
          } catch (e) {
            console.error(`解析Memo聊天数据时出错:`, e);
          }
        }
      }
    
      // 按照条目数量排序，多的在前面
      chats.sort((a, b) => b.count - a.count);
    
      return chats;
    }
    
    // 添加切换到指定聊天的函数
    function switchToChat(chatKey) {
      if (!chatKey) return;
    
      try {
        // 从键名中提取聊天上下文
        const contextPart = chatKey.substring(LOCAL_STORAGE_KEY_PREFIX.length);
    
        // 更新当前聊天上下文
        currentChatContext = contextPart;
    
        // 重新渲染列表
        renderMemoList();
    
        // 显示切换成功提示
        if (typeof toastr !== 'undefined') {
          toastr.success(`已切换到 ${contextPart.replace('-', ' - ')} 的Memo记录`);
        }
      } catch (e) {
        console.error('切换聊天失败:', e);
        if (typeof toastr !== 'undefined') {
          toastr.error('切换聊天失败');
        }
      }
    }
    
    // Memo排序函数
    function sortMemos(memos) {
      if (state.sortBy === 'time') {
        // 按时间排序
        memos.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt);
          const timeB = new Date(b.updatedAt || b.createdAt);
          return state.sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });
      } else if (state.sortBy === 'floor') {
        // 按楼层排序
        memos.sort((a, b) => {
          // 获取楼层号，特殊处理跨楼层和手动创建的情况
          const getFloorNumber = (memo) => {
            if (!memo.messageId || memo.messageId === '-' || memo.floorLabel === '手动创建' || memo.floorLabel === '跨楼层' || memo.floorLabel === '未知楼层') {
              return Number.MAX_SAFE_INTEGER; // 放到最后
            }
            return typeof memo.messageId === 'number' ? memo.messageId : parseInt(memo.messageId) || Number.MAX_SAFE_INTEGER;
          };
    
          const floorA = getFloorNumber(a);
          const floorB = getFloorNumber(b);
    
          // 如果两个都是特殊情况（都是MAX_SAFE_INTEGER），按时间排序
          if (floorA === Number.MAX_SAFE_INTEGER && floorB === Number.MAX_SAFE_INTEGER) {
            const timeA = new Date(a.updatedAt || a.createdAt);
            const timeB = new Date(b.updatedAt || b.createdAt);
            return timeB - timeA; // 最新的在前
          }
    
          return state.sortOrder === 'desc' ? floorB - floorA : floorA - floorB;
        });
      }
    }
    
    // 绑定筛选控制器事件
    function bindFilterEvents() {
      // 绑定排序方式按钮
      const filterButtons = modalBodyElement?.querySelectorAll('.memo-filter-btn');
      if (filterButtons) {
        filterButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            const sortBy = e.target.getAttribute('data-sort');
            if (sortBy && sortBy !== state.sortBy) {
              state.sortBy = sortBy;
              if (typeof toastr !== 'undefined') {
                toastr.info(`已切换到${sortBy === 'time' ? '时间' : '楼层'}排序`);
              }
              renderMemoList(); // 重新渲染列表
            }
          });
        });
      }
    
      // 绑定排序顺序按钮
      const orderButtons = modalBodyElement?.querySelectorAll('.memo-order-btn');
      if (orderButtons) {
        orderButtons.forEach(button => {
          button.addEventListener('click', (e) => {
            const sortOrder = e.target.getAttribute('data-order');
            if (sortOrder && sortOrder !== state.sortOrder) {
              state.sortOrder = sortOrder;
              const orderText = sortOrder === 'desc' ?
                (state.sortBy === 'time' ? '最新在前' : '楼层号大在前') :
                (state.sortBy === 'time' ? '最旧在前' : '楼层号小在前');
              if (typeof toastr !== 'undefined') {
                toastr.info(`排序顺序：${orderText}`);
              }
              renderMemoList(); // 重新渲染列表
            }
          });
        });
      }
    }
    
    // 绑定Memo操作按钮事件
    function bindMemoActionEvents() {
      // 绑定Memo框点击事件（进入编辑模式）
      const memoItems = modalBodyElement.querySelectorAll('.memo-item');
      memoItems.forEach(item => {
        item.addEventListener('click', (e) => {
          // 如果点击的是按钮，不触发编辑
          if (e.target.classList.contains('memo-action-button')) {
            return;
          }
    
          const memoId = parseInt(item.getAttribute('data-memo-id'));
          if (memoId) {
            editMemo(memoId);
          }
        });
      });
    
      // 绑定删除按钮事件
      const actionButtons = modalBodyElement.querySelectorAll('.memo-action-button');
      actionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // 阻止事件冒泡到父元素
          const memoId = parseInt(e.target.getAttribute('data-memo-id'));
          const action = e.target.getAttribute('data-action');
    
          if (action === 'share') {
            shareMemo(memoId);
          } else if (action === 'delete') {
            deleteMemo(memoId);
          }
        });
      });
    }
    
    function renderCreateMemo() {
      renderCreateMemoWithParagraph('', null);
    }
    
    function renderCreateMemoWithParagraph(paragraphText = '', sourceContext = null) {
      // 设置当前视图状态
      state.currentView = 'create';
    
      // 确保使用正确的聊天上下文 - 优先使用手动选择的上下文
      const displayContext = state.selectedChatContext || getCurrentChatContext();
    
      // 存储源上下文信息，用于后续保存时确定楼层
      state.currentSourceContext = sourceContext;
    
      // 从displayContext中提取角色名和聊天名
      let characterName = 'Unknown Character';
      let chatName = 'Unknown Chat';
    
      if (displayContext) {
        const parts = displayContext.split('-');
        if (parts.length >= 2) {
          characterName = parts[0].trim();
          chatName = parts.slice(1).join('-').trim();
        } else {
          chatName = displayContext;
        }
      }
    
      modalTitleElement.textContent = paragraphText ? '为段落创建Memo' : '新建Memo';
    
      // 加载Font Awesome，如果尚未加载
      ensureFontAwesomeLoaded();
    
      // 直接创建DOM元素而不是使用HTML字符串
      // 清空modalBodyElement
      modalBodyElement.innerHTML = '';
    
      // 创建表单容器
      const formContainer = MemoDoc.createElement('div');
      formContainer.className = 'memo-form';
    
      // 创建聊天信息
      const chatInfoDiv = MemoDoc.createElement('div');
      chatInfoDiv.className = 'memo-chat-info';
      chatInfoDiv.style.cursor = 'default';
      chatInfoDiv.style.marginBottom = '20px';
      chatInfoDiv.textContent = `保存到：${characterName} - ${chatName}`;
      formContainer.appendChild(chatInfoDiv);
    
      // 创建标题输入组
      const titleGroup = MemoDoc.createElement('div');
      titleGroup.className = 'memo-form-group';
    
      const titleLabel = MemoDoc.createElement('label');
      titleLabel.className = 'memo-form-label';
      titleLabel.htmlFor = MEMO_TITLE_INPUT_ID;
      titleLabel.textContent = '标题（可选）：';
      titleGroup.appendChild(titleLabel);
    
      const titleInput = MemoDoc.createElement('input');
      titleInput.type = 'text';
      titleInput.id = MEMO_TITLE_INPUT_ID;
      titleInput.placeholder = '留空将自动生成标题...';
      titleInput.value = '';
      titleGroup.appendChild(titleInput);
    
      formContainer.appendChild(titleGroup);
    
      // 如果有段落文本，创建原文段落输入组
      if (paragraphText) {
        const originalGroup = MemoDoc.createElement('div');
        originalGroup.className = 'memo-form-group';
    
        const originalLabel = MemoDoc.createElement('label');
        originalLabel.className = 'memo-form-label';
        originalLabel.htmlFor = 'memoOriginalTextInput';
        originalLabel.textContent = '原文段落（可编辑）：';
        originalGroup.appendChild(originalLabel);
    
        const originalContainer = MemoDoc.createElement('div');
        originalContainer.className = 'memo-textarea-container';
        originalContainer.style.position = 'relative';
    
        const originalTextarea = MemoDoc.createElement('textarea');
        originalTextarea.id = 'memoOriginalTextInput';
        originalTextarea.style.cssText = `
          padding: 12px 16px;
          border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
          border-radius: 10px;
          background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
          color: var(--SmartThemeBodyColor, #ffffff);
          min-height: 100px;
          max-height: 150px;
          resize: vertical;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.6;
          transition: all 0.3s ease;
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 8px;
        `;
        originalTextarea.placeholder = '编辑原文段落内容...';
        originalTextarea.value = paragraphText;
        originalContainer.appendChild(originalTextarea);
    
        const originalCopyBtn = MemoDoc.createElement('button');
        originalCopyBtn.className = 'memo-copy-button';
        originalCopyBtn.title = '复制原文内容';
        originalCopyBtn.setAttribute('data-target', 'memoOriginalTextInput');
        originalCopyBtn.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.1));
          color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
          border: none;
          padding: 4px;
          font-size: 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          z-index: 10002;
        `;
    
        const originalIcon = MemoDoc.createElement('i');
        originalIcon.className = 'fa-regular fa-clone';
        originalCopyBtn.appendChild(originalIcon);
        originalContainer.appendChild(originalCopyBtn);
    
        originalGroup.appendChild(originalContainer);
        formContainer.appendChild(originalGroup);
      }
    
      // 创建内容输入组
      const contentGroup = MemoDoc.createElement('div');
      contentGroup.className = 'memo-form-group';
    
      const contentLabel = MemoDoc.createElement('label');
      contentLabel.className = 'memo-form-label';
      contentLabel.htmlFor = MEMO_INPUT_ID;
      contentLabel.textContent = '内容：';
      contentGroup.appendChild(contentLabel);
    
      const contentContainer = MemoDoc.createElement('div');
      contentContainer.className = 'memo-textarea-container';
      contentContainer.style.position = 'relative';
    
      const contentTextarea = MemoDoc.createElement('textarea');
      contentTextarea.id = MEMO_INPUT_ID;
      contentTextarea.placeholder = paragraphText ? '记下你现在的想法吧...' : '请输入笔记内容...';
      contentTextarea.style.cssText = `
        padding: 12px 16px;
        border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
        border-radius: 10px;
        background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
        color: var(--SmartThemeBodyColor, #ffffff);
        min-height: 140px;
        resize: vertical;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.6;
        transition: all 0.3s ease;
        width: 100%;
        box-sizing: border-box;
      `;
      contentContainer.appendChild(contentTextarea);
    
      const contentCopyBtn = MemoDoc.createElement('button');
      contentCopyBtn.className = 'memo-copy-button';
      contentCopyBtn.title = '复制笔记内容';
      contentCopyBtn.setAttribute('data-target', MEMO_INPUT_ID);
      contentCopyBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.1));
        color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
        border: none;
        padding: 4px;
        font-size: 12px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.7;
        z-index: 10002;
      `;
    
      const contentIcon = MemoDoc.createElement('i');
      contentIcon.className = 'fa-regular fa-clone';
      contentCopyBtn.appendChild(contentIcon);
      contentContainer.appendChild(contentCopyBtn);
    
      contentGroup.appendChild(contentContainer);
      formContainer.appendChild(contentGroup);
    
      // 将表单添加到模态框
      modalBodyElement.appendChild(formContainer);
    
      // 检查复制按钮是否正确创建
      setTimeout(() => {
        const copyButtons = modalBodyElement.querySelectorAll('.memo-copy-button');
        copyButtons.forEach((btn) => {
          // 绑定点击事件
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const targetId = this.getAttribute('data-target');
            const textArea = MemoDoc.getElementById(targetId);
            if (textArea) {
              copyTextFromTextarea(textArea);
            }
          });
        });
      }, 100);
    
      // 为原文textarea添加focus样式
      if (paragraphText) {
        const originalTextInput = MemoDoc.getElementById('memoOriginalTextInput');
        if (originalTextInput) {
          originalTextInput.addEventListener('focus', function () {
            this.style.borderColor = 'var(--SmartThemeQuoteColor, #4a9eff)';
            this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08))';
            this.style.boxShadow = '0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2))';
          });
          originalTextInput.addEventListener('blur', function () {
            this.style.borderColor = 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';
            this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))';
            this.style.boxShadow = 'none';
          });
        }
      }
    
      // 渲染底部按钮
      modalFooterElement.innerHTML = '';
      modalFooterElement.appendChild(createButton('保存', 'primary', saveMemo));
      modalFooterElement.appendChild(createButton('取消', 'secondary', () => renderMemoList()));
    
      // 重新居中模态框
      requestAnimationFrame(() => {
        centerModal();
      });
    
      // 聚焦到合适的输入框
      setTimeout(() => {
        if (paragraphText) {
          // 如果是段落注释，聚焦到内容输入框
          const contentInput = MemoDoc.getElementById(MEMO_INPUT_ID);
          if (contentInput) contentInput.focus();
        } else {
          // 如果是新建Memo，聚焦到内容输入框
          const contentInput = MemoDoc.getElementById(MEMO_INPUT_ID);
          if (contentInput) contentInput.focus();
        }
      }, 100);
    }
    
    function renderEditMemo(memoId) {
      // 设置当前视图状态
      state.currentView = 'edit';
    
      // 确保使用正确的聊天上下文 - 优先使用手动选择的上下文
      const displayContext = state.selectedChatContext || getCurrentChatContext();
    
      const memos = loadMemosFromStorage(displayContext);
      const memo = memos.find(m => m.id === memoId);
    
      if (!memo) {
        toastr.error('Memo不存在！');
        renderMemoList();
        return;
      }
    
      modalTitleElement.textContent = '编辑Memo';
      state.editingMemoId = memoId;
    
      // 从displayContext中提取角色名和聊天名
      let characterName = 'Unknown Character';
      let chatName = 'Unknown Chat';
    
      if (displayContext) {
        const parts = displayContext.split('-');
        if (parts.length >= 2) {
          characterName = parts[0].trim();
          chatName = parts.slice(1).join('-').trim();
        } else {
          chatName = displayContext;
        }
      }
    
      // 加载Font Awesome，如果尚未加载
      ensureFontAwesomeLoaded();
    
      const html = `
            <div class="memo-form">
                <div class="memo-chat-info" style="cursor: default; margin-bottom: 20px;">
                    保存到：${escapeHtml(characterName)} - ${escapeHtml(chatName)}
                </div>
                <div class="memo-form-group">
                    <label class="memo-form-label" for="${MEMO_TITLE_INPUT_ID}">标题（可选）：</label>
                    <input type="text" id="${MEMO_TITLE_INPUT_ID}" 
                           placeholder="留空将自动生成标题..." 
                           value="${escapeHtml(memo.title || '')}" />
                </div>
                ${memo.type === 'annotation' && memo.originalText ? `
                <div class="memo-form-group">
                    <label class="memo-form-label" for="memoOriginalTextInput">原文段落（可编辑）：</label>
                    <div class="memo-textarea-container">
                        <button class="memo-copy-button" title="复制原文内容" data-target="memoOriginalTextInput">
                            <i class="fa-regular fa-clone"></i>
                        </button>
                        <textarea id="memoOriginalTextInput" 
                                 style="padding: 12px 16px;
                                        border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                                        border-radius: 10px;
                                        background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                                        color: var(--SmartThemeBodyColor, #ffffff);
                                        min-height: 100px;
                                        max-height: 150px;
                                        resize: vertical;
                                        font-family: inherit;
                                        font-size: 14px;
                                        line-height: 1.6;
                                        transition: all 0.3s ease;
                                        width: 100%;
                                        box-sizing: border-box;
                                        margin-bottom: 8px;"
                                 placeholder="编辑原文段落内容...">${escapeHtml(memo.originalText)}</textarea>
                    </div>
                </div>
                ` : ''}
                <div class="memo-form-group">
                    <label class="memo-form-label" for="${MEMO_INPUT_ID}">内容：</label>
                    <div class="memo-textarea-container">
                        <button class="memo-copy-button" title="复制笔记内容" data-target="${MEMO_INPUT_ID}">
                            <i class="fa-regular fa-clone"></i>
                        </button>
                        <textarea id="${MEMO_INPUT_ID}">${escapeHtml(memo.content)}</textarea>
                    </div>
                </div>
            </div>
        `;
    
      modalBodyElement.innerHTML = html;
    
      // 为原文textarea添加focus样式
      if (memo.type === 'annotation' && memo.originalText) {
        const originalTextInput = MemoDoc.getElementById('memoOriginalTextInput');
        if (originalTextInput) {
          originalTextInput.addEventListener('focus', function () {
            this.style.borderColor = 'var(--SmartThemeQuoteColor, #4a9eff)';
            this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08))';
            this.style.boxShadow = '0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2))';
          });
          originalTextInput.addEventListener('blur', function () {
            this.style.borderColor = 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';
            this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))';
            this.style.boxShadow = 'none';
          });
        }
      }
    
      // 绑定复制按钮事件
      const copyButtons = modalBodyElement.querySelectorAll('.memo-copy-button');
      copyButtons.forEach(button => {
        button.addEventListener('click', function (e) {
          e.stopPropagation();
          const targetId = this.getAttribute('data-target');
          const textArea = MemoDoc.getElementById(targetId);
          if (textArea) {
            copyTextFromTextarea(textArea);
          }
        });
      });
    
      // 渲染底部按钮
      modalFooterElement.innerHTML = '';
      modalFooterElement.appendChild(createButton('保存修改', 'primary', updateMemo));
      modalFooterElement.appendChild(createButton('取消', 'secondary', () => renderMemoList()));
    
      // 重新居中模态框
      requestAnimationFrame(() => {
        centerModal();
      });
    }
    
    
    function saveMemo() {
      const titleInput = MemoDoc.getElementById(MEMO_TITLE_INPUT_ID);
      const contentInput = MemoDoc.getElementById(MEMO_INPUT_ID);
      const originalTextInput = MemoDoc.getElementById('memoOriginalTextInput');
    
      if (!titleInput || !contentInput) {
        toastr.error('找不到输入框！');
        return;
      }
    
      const title = titleInput.value.trim();
      const content = contentInput.value.trim();
      const originalText = originalTextInput ? originalTextInput.value.trim() : '';
    
      // 如果既没有原文又没有内容，才提示错误
      // 有原文的memo可以不填写笔记内容
      if (!content && !originalText) {
        toastr.warning('请输入Memo内容！');
        contentInput.focus();
        return;
      }
    
      // 确定要使用的聊天上下文 - 优先使用手动选择的上下文
      const saveContext = state.selectedChatContext || getCurrentChatContext();
      console.log('保存Memo到聊天上下文:', saveContext); // 调试日志
    
      const memos = loadMemosFromStorage(saveContext);
    
      // 计算楼层信息
      let messageId = null;
      let floorLabel = '手动创建';
    
      if (originalText && state.currentSourceContext) {
        // 如果是段落Memo且有源上下文信息，使用上下文中的楼层信息
        messageId = state.currentSourceContext.messageId;
        floorLabel = state.currentSourceContext.floorLabel;
      } else if (originalText) {
        // 兼容旧代码：如果是段落Memo但没有源上下文信息
        if (selectionState.selectedParagraphs && selectionState.selectedParagraphs.length > 0) {
          // 多选模式：检查是否跨楼层
          const messageIds = selectionState.selectedParagraphs
            .map(p => p.messageId)
            .filter(id => id !== null && id !== undefined);
    
          if (messageIds.length === 0) {
            messageId = null;
            floorLabel = '未知楼层';
          } else {
            const uniqueMessageIds = [...new Set(messageIds)];
            if (uniqueMessageIds.length === 1) {
              // 同楼层
              messageId = uniqueMessageIds[0];
              floorLabel = generateFloorLabel(messageId);
            } else {
              // 跨楼层
              messageId = '-';
              floorLabel = '跨楼层';
            }
          }
        } else {
          // 单选模式：尝试从当前DOM解析楼层（这个情况比较少见，因为通常都是通过按钮触发的）
          messageId = null;
          floorLabel = '未知楼层';
        }
      }
    
      const newMemo = {
        id: Date.now(),
        title: title,
        content: content,
        originalText: originalText, // 保存原始段落文本
        type: originalText ? 'annotation' : 'normal', // 标记Memo类型
        messageId: messageId, // 楼层ID
        floorLabel: floorLabel, // 楼层显示标签
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    
      memos.push(newMemo);
      saveMemosToStorage(saveContext, memos);
    
      // 清理源上下文信息
      state.currentSourceContext = null;
    
      toastr.success(originalText ? `段落Memo已保存到 "${saveContext.replace('-', ' - ')}"！` : `Memo已保存到 "${saveContext.replace('-', ' - ')}"！`);
      renderMemoList();
    }
    
    function updateMemo() {
      const titleInput = MemoDoc.getElementById(MEMO_TITLE_INPUT_ID);
      const contentInput = MemoDoc.getElementById(MEMO_INPUT_ID);
      const originalTextInput = MemoDoc.getElementById('memoOriginalTextInput');
    
      if (!titleInput || !contentInput) {
        toastr.error('找不到输入框！');
        return;
      }
    
      const title = titleInput.value.trim();
      const content = contentInput.value.trim();
      const originalText = originalTextInput ? originalTextInput.value.trim() : '';
    
      // 如果既没有原文又没有内容，才提示错误  
      // 有原文的memo可以不填写笔记内容
      if (!content && !originalText) {
        toastr.warning('请输入Memo内容！');
        contentInput.focus();
        return;
      }
    
      // 确定要使用的聊天上下文 - 优先使用手动选择的上下文
      const saveContext = state.selectedChatContext || getCurrentChatContext();
      const memos = loadMemosFromStorage(saveContext);
      const memoId = state.editingMemoId;
    
      const memoIndex = memos.findIndex(m => m.id === memoId);
      if (memoIndex !== -1) {
        memos[memoIndex].title = title;
        memos[memoIndex].content = content;
        // 如果有原文输入框，也更新原文内容
        if (originalTextInput) {
          memos[memoIndex].originalText = originalText;
        }
        memos[memoIndex].updatedAt = new Date().toISOString();
    
        saveMemosToStorage(saveContext, memos);
        toastr.success('Memo已更新！');
        renderMemoList();
      } else {
        toastr.error('Memo不存在！');
        renderMemoList();
      }
    }
    
    function deleteMemo(memoId) {
      if (!confirm('确定要删除这条Memo吗？')) {
        return;
      }
    
      // 确定要使用的聊天上下文 - 优先使用手动选择的上下文
      const saveContext = state.selectedChatContext || getCurrentChatContext();
      const memos = loadMemosFromStorage(saveContext);
      const memoIndex = memos.findIndex(m => m.id === memoId);
    
      if (memoIndex !== -1) {
        memos.splice(memoIndex, 1);
        saveMemosToStorage(saveContext, memos);
        toastr.success('Memo已删除！');
        renderMemoList();
      } else {
        toastr.error('Memo不存在！');
      }
    }
    
    function editMemo(memoId) {
      renderEditMemo(memoId);
    }
    
    function centerModal() {
      if (!modalDialogElement) return;
    
      const windowWidth = window.innerWidth || MemoDoc.documentElement.clientWidth || MemoDoc.body.clientWidth;
      const windowHeight = window.innerHeight || MemoDoc.documentElement.clientHeight || MemoDoc.body.clientHeight;
    
      const dialogWidth = modalDialogElement.offsetWidth || 750;
      const dialogHeight = modalDialogElement.offsetHeight || 600;
    
      const left = Math.max(0, (windowWidth - dialogWidth) / 2);
      const top = Math.max(0, (windowHeight - dialogHeight) / 2);
    
      modalDialogElement.style.left = `${left}px`;
      modalDialogElement.style.top = `${top}px`;
    }
    
    function openMemoModal() {
      ensureModalStructure();
      modalElement.style.display = 'block';
    
      // 重置手动选择的聊天上下文
      state.selectedChatContext = null;
    
      // 加载GitHub配置
      loadGitHubConfig();
      
      // 加载LLM配置
      loadLLMConfig();
      
      // 加载样式偏好
      const savedStyle = loadStylePreference();
      console.log('Memo: 已加载样式偏好:', savedStyle);
    
      // 如果没有菜单按钮，创建一个
      createMemoMenuButton();
    
      // 等待一帧以确保DOM已渲染完成，然后居中显示
      requestAnimationFrame(() => {
        centerModal();
      });
    
      renderMemoList();
    
      // 监听聊天切换事件
      setupChatChangeListener();
    
      // 监听窗口大小变化，重新居中
      window.addEventListener('resize', centerModal);
    
      // 添加ESC键关闭模态框
      MemoDoc.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeMemoModal();
        }
      });
    }
    
    function closeMemoModal() {
      if (modalElement) {
        modalElement.style.display = 'none';
      }
    
      // 移除聊天切换事件监听器
      removeChatChangeListener();
    
      // 移除窗口大小变化监听器
      window.removeEventListener('resize', centerModal);
    
      state.currentView = 'list';
      state.editingMemoId = null;
      state.currentSourceContext = null;  // 清理源上下文信息
    }
    
    // 设置聊天切换事件监听器
    function setupChatChangeListener() {
      // 移除之前的监听器（如果存在）
      removeChatChangeListener();
    
      // 创建事件处理函数
      chatChangeListener = function (event) {
        // 只在模态框打开且在列表视图时才自动刷新
        if (modalElement && modalElement.style.display === 'block' && state.currentView === 'list') {
          const newContext = getCurrentChatContext();
          if (currentChatContext !== newContext) {
            // 更新当前聊天上下文
            currentChatContext = newContext;
    
            // 如果没有手动选择的聊天，则刷新显示
            if (!state.selectedChatContext) {
              renderMemoList();
            }
          }
        }
      };
    
      // 尝试监听多种可能的聊天切换事件
      const eventTypes = [
        'CHAT_CHANGED',
        'chat_changed',
        'chatChanged',
        'character_selected',
        'CHARACTER_SELECTED'
      ];
    
      eventTypes.forEach(eventType => {
        try {
          // 尝试监听 document 上的自定义事件
          MemoDoc.addEventListener(eventType, chatChangeListener);
        } catch (e) {
          // 静默忽略注册失败
        }
      });
    
      // 如果存在 eventSource 或其他事件分发器，也尝试监听
      if (window.eventSource && typeof window.eventSource.addEventListener === 'function') {
        try {
          window.eventSource.addEventListener('CHAT_CHANGED', chatChangeListener);
        } catch (e) {
          // 静默忽略注册失败
        }
      }
    }
    
    // 移除聊天切换事件监听器
    function removeChatChangeListener() {
      if (chatChangeListener) {
        const eventTypes = [
          'CHAT_CHANGED',
          'chat_changed',
          'chatChanged',
          'character_selected',
          'CHARACTER_SELECTED'
        ];
    
        eventTypes.forEach(eventType => {
          try {
            MemoDoc.removeEventListener(eventType, chatChangeListener);
          } catch (e) {
            // 静默忽略移除失败
          }
        });
    
        if (window.eventSource && typeof window.eventSource.removeEventListener === 'function') {
          try {
            window.eventSource.removeEventListener('CHAT_CHANGED', chatChangeListener);
          } catch (e) {
            // 静默忽略移除失败
          }
        }
    
        chatChangeListener = null;
      }
    }
    
    
    function escapeHtml(text) {
      const div = MemoDoc.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    // 生成显示用的标题
    function getDisplayTitle(memo) {
      // 如果有自定义标题，直接使用
      if (memo.title && memo.title.trim()) {
        return memo.title.trim();
      }
    
      // 没有标题时，根据类型生成
      if (memo.type === 'annotation' && memo.originalText && memo.originalText.trim()) {
    
        const text = memo.originalText.trim();
        return text.length > 8 ? text.substring(0, 8) + '...' : text;
      } else if (memo.content && memo.content.trim()) {
    
        const text = memo.content.trim();
        return text.length > 8 ? text.substring(0, 8) + '...' : text;
      } else {
    
        return '无标题Memo';
      }
    }
    
    function createMemoMenuButton(retryCount = 0) {
      const MAX_RETRIES = 5;
      const RETRY_DELAY = 500;
    
      if (MemoDoc.getElementById(MENU_BUTTON_ID)) {
        return;
      }
    
      const extensionsMenu = MemoDoc.getElementById('extensions_menu') || MemoDoc.getElementById('extensionsMenu');
    
      if (extensionsMenu) {
        const menuButton = MemoDoc.createElement('div');
        menuButton.id = MENU_BUTTON_ID;
        menuButton.className = 'list-group-item flex-container flexGap5 interactable';
        menuButton.setAttribute('tabindex', '0');
        menuButton.title = 'Memo';
    
        const iconSpan = MemoDoc.createElement('span');
        iconSpan.textContent = '✎';
        menuButton.appendChild(iconSpan);
    
        const textSpan = MemoDoc.createElement('span');
        textSpan.textContent = 'Memo';
        menuButton.appendChild(textSpan);
    
        menuButton.onclick = openMemoModal;
        extensionsMenu.prepend(menuButton);
      } else {
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => createMemoMenuButton(retryCount + 1), RETRY_DELAY);
        }
      }
    }
    
    window.closeMemoModal = closeMemoModal;
    
    function initializeMemo() {
      if (MemoDoc.readyState === 'loading') {
        MemoDoc.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            // 加载GitHub配置
            loadGitHubConfig();
            
            // 加载LLM配置
            loadLLMConfig();
            
            // 加载样式偏好
            const savedStyle = loadStylePreference();
            console.log('Memo: 已加载样式偏好:', savedStyle);
    
            // 加载自定义颜色配置
            loadCustomColorConfig();
            console.log('Memo: 已加载自定义颜色配置');

            // 加载保存的配色方案
            loadSavedColorSchemes();
            console.log('Memo: 已加载保存的配色方案');
    
            // 加载字体配置
            loadFontPreference();
            loadCustomFonts();
            loadAllCustomFonts().then(() => {
              console.log('Memo: 已加载所有网络字体');
            }).catch(error => {
              console.error('Memo: 加载网络字体失败:', error);
            });
    
            // 如果没有菜单按钮，创建一个
            createMemoMenuButton();
    
            // 页面卸载时清理事件监听器
            window.addEventListener('beforeunload', () => {
              removeChatChangeListener();
            });
          }, 1000);
        });
      } else {
        try {
          // 清理之前可能存在的事件监听器
          removeChatChangeListener();
    
          // 注入样式
          injectStyles();
    
          // 确保Font Awesome已加载
          ensureFontAwesomeLoaded();
    
          // 加载GitHub配置
          loadGitHubConfig();
          
          // 加载LLM配置
          loadLLMConfig();
          
          // 加载样式偏好
          const savedStyle = loadStylePreference();
          console.log('Memo: 已加载样式偏好:', savedStyle);
    
          // 加载自定义颜色配置
          loadCustomColorConfig();
          console.log('Memo: 已加载自定义颜色配置');

          // 加载保存的配色方案
          loadSavedColorSchemes();
          console.log('Memo: 已加载保存的配色方案');
    
          // 加载字体配置
          loadFontPreference();
          loadCustomFonts();
          loadAllCustomFonts().then(() => {
            console.log('Memo: 已加载所有网络字体');
          }).catch(error => {
            console.error('Memo: 加载网络字体失败:', error);
          });
    
          // 如果没有菜单按钮，创建一个
          createMemoMenuButton();
    
          // 页面卸载时清理事件监听器
          window.addEventListener('beforeunload', () => {
            removeChatChangeListener();
            stopMessageObserver();
          });
        } catch (error) {
          console.error('Memo: 初始化失败:', error);
        }
      }
    }
    
    // 初始化调用
    initializeMemo();
    
    // 消息观察器相关函数
    function initMessageObserver() {
      try {
        // 移除之前的观察器
        if (messageObserver) {
          messageObserver.disconnect();
        }
    
        // 查找聊天容器
        const chatContainer = MemoDoc.querySelector('#chat') ||
          MemoDoc.querySelector('.chat-container') ||
          MemoDoc.querySelector('[id*="chat"]');
    
        if (!chatContainer) {
          console.log('Memo: 未找到聊天容器，稍后重试...');
          // 5秒后重试
          setTimeout(() => initMessageObserver(), 5000);
          return;
        }
    
        console.log('Memo: 开始监听消息变化...');
    
        messageObserver = new MutationObserver((mutations) => {
          let needsUpdate = false;
    
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  needsUpdate = true;
                }
              });
            }
          });
    
          if (needsUpdate) {
            // 防抖处理，避免频繁更新
            clearTimeout(window.memoAnnotationTimeout);
            window.memoAnnotationTimeout = setTimeout(() => {
              injectParagraphButtons(chatContainer);
            }, 300);
          }
        });
    
        messageObserver.observe(chatContainer, {
          childList: true,
          subtree: true
        });
    
        // 初始化现有消息
        setTimeout(() => {
          injectParagraphButtons(chatContainer);
          // 创建控制面板
          createControlPanel();
        }, 1000);
    
        // 监听窗口大小变化，重新定位控制面板
        window.addEventListener('resize', () => {
          if (selectionState.controlPanel) {
            setTimeout(() => {
              positionControlPanel();
            }, 100);
          }
        });
    
      } catch (error) {
        console.error('Memo: 初始化消息观察器失败:', error);
      }
    }
    
    function injectParagraphButtons(container) {
      try {
        // 查找所有消息中的段落
        const selectors = [
          '.mes_text p',
          '.message_text p',
          '.mes_text div:not(.memo-annotation-btn):not([class*="btn"]):not([class*="button"]), .message_text div:not(.memo-annotation-btn):not([class*="btn"]):not([class*="button"])'
        ];
    
        selectors.forEach(selector => {
          const paragraphs = container.querySelectorAll(selector);
          paragraphs.forEach((paragraph, index) => {
            // 检查段落是否有足够的文本内容（排除按钮文本）
            const textContent = getPureTextContent(paragraph);
            if (!textContent || textContent.length < 1) {
              return; // 跳过太短的内容
            }
    
            // 检查是否已经有按钮
            if (!paragraph.querySelector('.memo-annotation-btn')) {
              createAnnotationButton(paragraph, index);
            }
          });
        });
    
      } catch (error) {
        console.error('Memo: 注入段落按钮失败:', error);
      }
    }
    
    function createAnnotationButton(paragraph, index) {
      try {
        const button = MemoDoc.createElement('button');
        button.className = 'memo-annotation-btn';
        button.title = selectionState.isMultiSelectMode ? '点击选择段落' : '为此段落创建Memo';
    
        // 根据模式设置按钮内容
        updateButtonContent(button, paragraph);
    
        // 绑定点击事件
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
    
          if (selectionState.isMultiSelectMode) {
            toggleParagraphSelection(paragraph, button);
          } else {
            const paragraphText = getPureTextContent(paragraph);
            if (paragraphText) {
              // 单选模式：获取楼层信息并传递
              const messageId = getMessageId(paragraph);
              const sourceContext = {
                type: 'single',
                messageId: messageId,
                floorLabel: generateFloorLabel(messageId)
              };
              // 单选模式也在最后加上可爱的✎符号
              openAnnotationMemo(paragraphText + ' ✎', sourceContext);
            }
          }
        });
    
        // 设置段落为相对定位
        paragraph.style.position = 'relative';
    
        // 添加按钮到段落
        paragraph.appendChild(button);
    
      } catch (error) {
        console.error('Memo: 创建按钮失败:', error);
      }
    }
    
    // 更新按钮内容和样式
    function updateButtonContent(button, paragraph) {
      if (selectionState.isMultiSelectMode) {
        const isSelected = selectionState.selectedParagraphs.some(p => p.element === paragraph);
        button.innerHTML = isSelected ? '☑' : '☐';
        button.classList.toggle('selected', isSelected);
      } else {
        button.innerHTML = '✎';
        button.classList.remove('selected');
      }
    }
    
    function openAnnotationMemo(paragraphText, sourceContext = null) {
      try {
        // 确保模态框结构存在
        ensureModalStructure();
    
        // 显示模态框
        modalElement.style.display = 'block';
    
        // 渲染创建Memo界面，预填充段落内容
        renderCreateMemoWithParagraph(paragraphText, sourceContext);
    
        // 监听聊天切换事件
        setupChatChangeListener();
    
        // 监听窗口大小变化，重新居中
        window.addEventListener('resize', centerModal);
    
        // 居中显示
        requestAnimationFrame(() => {
          centerModal();
        });
    
      } catch (error) {
        console.error('Memo: 打开段落Memo失败:', error);
        toastr.error('打开Memo功能失败，请重试');
      }
    }
    
    // 停止消息观察器
    function stopMessageObserver() {
      if (messageObserver) {
        messageObserver.disconnect();
        messageObserver = null;
      }
    }
    
    // 分享Memo功能
    function shareMemo(memoId) {
      try {
        // 确保使用最新的聊天上下文
        currentChatContext = getCurrentChatContext();
        let memos = loadMemosFromStorage(currentChatContext);
        let memo = memos.find(m => m.id === memoId);
    
        // 如果在当前上下文中找不到，尝试在所有上下文中查找
        if (!memo) {
          // 遍历localStorage中所有以memo_开头的键
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
              try {
                const contextData = localStorage.getItem(key);
                if (contextData) {
                  const contextMemos = JSON.parse(contextData);
                  const foundMemo = contextMemos.find(m => m.id === memoId);
                  if (foundMemo) {
                    memo = foundMemo;
                    console.log('在其他上下文找到Memo:', key);
                    break;
                  }
                }
              } catch (e) {
                console.error(`解析键 ${key} 的数据时出错:`, e);
              }
            }
          }
        }
    
        if (!memo) {
          toastr.error('Memo不存在！');
          return;
        }
    
        if (memo.type !== 'annotation' || !memo.originalText) {
          toastr.error('只能分享段落注释！');
          return;
        }
    
        // 直接生成默认样式(长夏)的图片
        toastr.info('正在生成图片预览...');
    
        const preferredStyle = loadStylePreference();
        const preferredFont = loadFontPreference();
        generateMemoImage(memo, preferredStyle, preferredFont).then(imageDataUrl => {
          showImagePreviewWithStyleSelector(imageDataUrl, memo, preferredStyle);
          toastr.success('图片生成成功！');
        }).catch(error => {
          console.error('Memo: 生成图片失败:', error);
          toastr.error('生成图片失败，请重试');
        });
    
      } catch (error) {
        console.error('Memo: 分享Memo失败:', error);
        toastr.error('分享功能出错，请重试');
      }
    }
    
    // 显示风格选择界面
    function showImagePreviewWithStyleSelector(imageDataUrl, memo, currentStyle) {
      // 设置当前视图状态
      state.currentView = 'style-selection';
    
      modalTitleElement.textContent = '选择卡片风格';
    
      const html = `
        <div style="padding: 20px 0;">
          <div style="margin-bottom: 20px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 14px; text-align: center;">
            为"${escapeHtml(getDisplayTitle(memo))}"选择分享卡片
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0;">
            <!-- 长夏 -->
            <div class="style-option" data-style="summer" style="
              border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              cursor: pointer;
              transition: all 0.3s ease;
              background: linear-gradient(135deg, #e8f8e8 0%, #f0fff0 100%);
            ">
              <div style="
                width: 100%;
                height: 80px;
                border-radius: 8px;
                margin-bottom: 12px;
                background: linear-gradient(135deg, #e8f8e8 0%, #f0fff0 20%, #e6ffe6 40%, #d4f8d4 60%, #e8f8e8 80%, #c8f0c8 100%);
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 8px;
                  left: 8px;
                  font-size: 10px;
                  color: #2d5a2d;
                  font-family: serif;
                ">预览</div>
                <div style="
                  position: absolute;
                  top: 20px;
                  left: 8px;
                  right: 8px;
                  height: 2px;
                  background: #28a745;
                  width: 30px;
                "></div>
              </div>
              <h4 style="margin: 0 0 8px 0; color: #2d5a2d; font-size: 14px;">长夏</h4>
            </div>
    
            <!-- 如是说 -->
            <div class="style-option" data-style="papper" style="
              border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              cursor: pointer;
              transition: all 0.3s ease;
              background: linear-gradient(135deg, #f5f2e8 0%, #f8f5eb 100%);
            ">
              <div style="
                width: 100%;
                height: 80px;
                border-radius: 8px;
                margin-bottom: 12px;
                background: linear-gradient(135deg, #f5f2e8 0%, #f8f5eb 30%, #f2efdf 70%, #f6f3e5 100%);
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 8px;
                  left: 8px;
                  font-size: 10px;
                  color: #5d4e37;
                  font-family: serif;
                ">预览</div>
                <div style="
                  position: absolute;
                  top: 20px;
                  left: 8px;
                  right: 8px;
                  height: 2px;
                  background: #2c5aa0;
                  width: 30px;
                "></div>
              </div>
              <h4 style="margin: 0 0 8px 0; color: #5d4e37; font-size: 14px;">如是说</h4>
            </div>
    
            <!-- 棉花糖 -->
            <div class="style-option" data-style="marshmallow" style="
              border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              cursor: pointer;
              transition: all 0.3s ease;
              background: linear-gradient(135deg, #f8f9ff 0%, #fff5f0 100%);
            ">
              <div style="
                width: 100%;
                height: 80px;
                border-radius: 8px;
                margin-bottom: 12px;
                background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 30%, #fff0f5 70%, #fff5f0 100%);
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 8px;
                  left: 8px;
                  font-size: 10px;
                  color: #666;
                  font-family: serif;
                ">预览</div>
                <div style="
                  position: absolute;
                  top: 20px;
                  left: 8px;
                  right: 8px;
                  height: 2px;
                  background: #4a9eff;
                  width: 30px;
                "></div>
              </div>
              <h4 style="margin: 0 0 8px 0; color: #2c3e50; font-size: 14px;">棉花糖</h4>
            </div>
    
            <!-- 朱砂痣 -->
            <div class="style-option" data-style="rose" style="
              border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              cursor: pointer;
              transition: all 0.3s ease;
              background: linear-gradient(135deg, #f8e6e6 0%, #fde4e4 100%);
            ">
              <div style="
                width: 100%;
                height: 80px;
                border-radius: 8px;
                margin-bottom: 12px;
                background: linear-gradient(135deg, #f8e6e6 0%, #fce8e8 20%, #f5dede 40%, #f9e0e0 60%, #fde4e4 80%, #f1d0d0 100%);
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 8px;
                  left: 8px;
                  font-size: 10px;
                  color: #8b4a4a;
                  font-family: serif;
                ">预览</div>
                <div style="
                  position: absolute;
                  top: 20px;
                  left: 8px;
                  right: 8px;
                  height: 2px;
                  background: #a64545;
                  width: 30px;
                "></div>
              </div>
              <h4 style="margin: 0 0 8px 0; color: #8b4a4a; font-size: 14px;">朱砂痣</h4>
            </div>
    
            <!-- 泥沼中 -->
            <div class="style-option" data-style="drowninlove" style="
              border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
              border-radius: 12px;
              padding: 16px;
              text-align: center;
              cursor: pointer;
              transition: all 0.3s ease;
              background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            ">
              <div style="
                width: 100%;
                height: 80px;
                border-radius: 8px;
                margin-bottom: 12px;
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 30%, #1a1a2e 70%, #0f0f23 100%);
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 8px;
                  left: 8px;
                  font-size: 10px;
                  color: #bbb;
                  font-family: serif;
                ">预览</div>
                <div style="
                  position: absolute;
                  top: 20px;
                  left: 8px;
                  right: 8px;
                  height: 2px;
                  background: #00d4ff;
                  width: 30px;
                "></div>
              </div>
              <h4 style="margin: 0 0 8px 0; color: #fff; font-size: 14px;">泥沼中</h4>
            </div>
          </div>
        </div>
    
        <style>
          .style-option:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
            border-color: var(--SmartThemeQuoteColor, #4a9eff) !important;
          }
          
          @media (max-width: 768px) {
            .style-option {
              grid-template-columns: 1fr !important;
            }
          }
        </style>
      `;
    
      modalBodyElement.innerHTML = html;
    
      // 绑定风格选择事件
      const styleOptions = modalBodyElement.querySelectorAll('.style-option');
      styleOptions.forEach(option => {
        option.addEventListener('click', () => {
          const style = option.getAttribute('data-style');
          generateImageWithStyle(memo, style);
        });
      });
    
      // 渲染底部按钮
      modalFooterElement.innerHTML = '';
      modalFooterElement.appendChild(createButton('返回', 'secondary', () => renderMemoList()));
    
      // 重新居中模态框
      requestAnimationFrame(() => {
        centerModal();
      });
    }
    
    // 使用指定风格生成图片
    function generateImageWithStyle(memo, style) {
      // 显示加载提示
      toastr.info('正在生成图片...');
    
      // 生成图片
      generateMemoImage(memo, style).then(imageDataUrl => {
        // 显示图片预览
        showImagePreview(imageDataUrl, memo, style);
        toastr.success('图片生成成功！');
      }).catch(error => {
        console.error('Memo: 生成图片失败:', error);
        toastr.error('生成图片失败，请重试');
      });
    }
    
    // 显示图片预览
    function showImagePreview(imageDataUrl, memo, style) {
      // 设置当前视图状态
      state.currentView = 'preview';
    
      modalTitleElement.textContent = '图片预览';
    
      const html = `
        <div style="text-align: center; padding: 20px 0;">
          <div style="margin-bottom: 20px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 14px;">
            ${escapeHtml(getDisplayTitle(memo))} - ${style === 'marshmallow' ? '棉花糖 - 粉蓝' :
          style === 'drowninlove' ? '泥沼中 - 青黑' :
            style === 'summer' ? '长夏 - 绿色' :
              style === 'papper' ? '如是说 - 信纸' :
                style === 'rose' ? '朱砂痣 - 朱红' :
                  style === 'ink' ? '缓缓 - 淡墨' : '未知'
        }风格
          </div>
          <div style="max-height: 500px; overflow: auto; border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1)); border-radius: 8px; background: #fff; padding: 10px;">
            <img src="${imageDataUrl}" style="max-width: 100%; height: auto; border-radius: 4px;" alt="Memo图片" />
          </div>
        </div>
      `;
    
      modalBodyElement.innerHTML = html;
    
      // 渲染底部按钮
      modalFooterElement.innerHTML = '';
      modalFooterElement.appendChild(createButton('下载图片', 'primary', () => downloadImage(imageDataUrl, memo, style)));
      modalFooterElement.appendChild(createButton('重新选择风格', 'secondary', () => showImagePreviewWithStyleSelector(imageDataUrl, memo, style)));
      modalFooterElement.appendChild(createButton('返回列表', 'secondary', () => renderMemoList()));
    
      // 重新居中模态框
      requestAnimationFrame(() => {
        centerModal();
      });
    }
    
    // 下载图片
    function downloadImage(imageDataUrl, memo, style) {
      try {
        // 生成更有意义的文件名
        const displayTitle = getDisplayTitle(memo);
        const safeTitle = displayTitle.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 20);
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:\-]/g, '');
        const fileName = `memo_usage_report_${timestamp}.png`;
    
        // 创建下载链接
        const link = MemoDoc.createElement('a');
        link.href = imageDataUrl;
        link.download = fileName;
    
        // 触发下载
        MemoDoc.body.appendChild(link);
        link.click();
        MemoDoc.body.removeChild(link);
    
        toastr.success('图片已下载！');
        
        // 保存样式偏好
        saveStylePreference(style);
      } catch (error) {
        console.error('Memo: 下载图片失败:', error);
        toastr.error('下载失败，请重试');
      }
    }
    
    // 生成Memo图片
    function generateMemoImage(memo, style = 'summer', customFont = 'QiushuiShotai') {
      return new Promise((resolve, reject) => {
        try {
          // 定义主题配置
          const themes = {
            custom: {
              name: '自定义配色',
              background: {
                colors: [state.customColorConfig.color1, state.customColorConfig.color2]
              },
              colors: {
                userInfo: state.customColorConfig.fontColor,
                time: state.customColorConfig.fontColor,
                title: state.customColorConfig.fontColor,
                accent: state.customColorConfig.fontColor,
                excerpt: state.customColorConfig.fontColor,
                notes: state.customColorConfig.fontColor,
                brand: state.customColorConfig.fontColor,
                decorativeLine: state.customColorConfig.fontColor,
                separatorLine: state.customColorConfig.fontColor
              }
            },
            marshmallow: {
              name: '棉花糖 - 粉蓝',
              background: {
                colors: ['#f8f9ff', '#f0f4ff', '#fff0f5', '#fff5f0']
              },
              colors: {
                userInfo: '#666',
                time: '#999',
                title: '#2c3e50',
                accent: '#4a9eff',
                excerpt: '#34495e',
                notes: '#555',
                brand: '#999',
                decorativeLine: '#4a9eff',
                separatorLine: '#e0e0e0'
              }
            },
            drowninlove: {
              name: '泥沼中 - 青黑',
              background: {
                colors: ['#000000', '#0a0a0a', '#050505', '#000000']
              },
              colors: {
                userInfo: '#00cccc',
                time: '#008888',
                title: '#00ffff',
                accent: '#00ffff',
                excerpt: '#00eeee',
                notes: '#00dddd',
                brand: '#00aaaa',
                decorativeLine: '#00ffff',
                separatorLine: '#003333'
              }
            },
            summer: {
              name: '长夏 - 绿色',
              background: {
                colors: ['#f0fff0', '#e8f8e8', '#d8f0d8', '#c8e8c8']
              },
              colors: {
                userInfo: '#2d5a2d',
                time: '#5a7a5a',
                title: '#1e3a1e',
                accent: '#28a745',
                excerpt: '#2d5a2d',
                notes: '#3d6a3d',
                brand: '#5a7a5a',
                decorativeLine: '#28a745',
                separatorLine: '#b8d8b8'
              }
            },
            papper: {
              name: '如是说 - 信纸',
              background: {
                colors: ['#f5f2e8', '#f8f5eb', '#f2efdf', '#f6f3e5']
              },
              colors: {
                userInfo: '#5d4e37',
                time: '#8b7d6b',
                title: '#2c5aa0',
                accent: '#2c5aa0',
                excerpt: '#2c5aa0',
                notes: '#4a4a4a',
                brand: '#8b7d6b',
                decorativeLine: '#2c5aa0',
                separatorLine: '#d4c5a9'
              }
            },
            rose: {
              name: '朱砂痣 - 朱红',
              background: {
                colors: ['#fdf5f5', '#f8e6e6', '#f0d0d0', '#e8c0c0']
              },
              colors: {
                userInfo: '#8b4a4a',
                time: '#a05656',
                title: '#a64545',
                accent: '#a64545',
                excerpt: '#a64545',
                notes: '#735555',
                brand: '#a05656',
                decorativeLine: '#a64545',
                separatorLine: '#e8c5c5'
              }
            },
            ink: {
              name: '缓缓 - 淡墨',
              background: {
                colors: ['#f8f8f8', '#f0f0f0', '#e8e8e8', '#f5f5f5']
              },
              colors: {
                userInfo: '#2c3e50',
                time: '#34495e',
                title: '#1a237e',
                accent: '#3949ab',
                excerpt: '#283593',
                notes: '#1a237e',
                brand: '#5c6bc0',
                decorativeLine: '#3949ab',
                separatorLine: '#bdc3c7'
              }
            }
          };

          // 处理保存的配色方案
          if (style.startsWith('saved:')) {
            const schemeName = style.replace('saved:', '');
            const scheme = state.savedColorSchemes[schemeName];
            
            if (scheme) {
              themes[style] = {
                name: schemeName,
                background: {
                  colors: [scheme.color1, scheme.color2]
                },
                colors: {
                  userInfo: scheme.fontColor,
                  time: scheme.fontColor,
                  title: scheme.fontColor,
                  accent: scheme.fontColor,
                  excerpt: scheme.fontColor,
                  notes: scheme.fontColor,
                  brand: scheme.fontColor,
                  decorativeLine: scheme.fontColor,
                  separatorLine: scheme.fontColor
                }
              };
            }
          }
          
          const theme = themes[style] || themes.summer;
          
          const canvas = MemoDoc.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // 设置画布尺寸（类似手机屏幕比例）
          const width = 800;
          // 先计算内容所需的高度
          const estimatedHeight = calculateContentHeight(ctx, memo, width, customFont);
          const height = Math.max(250, estimatedHeight + 3); // 最小高度250px，加3px的缓冲
          
          canvas.width = width;
          canvas.height = height;
          
          // 设置画布缩放以获得更清晰的文字
          const scale = 2;
          canvas.width = width * scale;
          canvas.height = height * scale;
          canvas.style.width = width + 'px';
          canvas.style.height = height + 'px';
          ctx.scale(scale, scale);
          
          // 绘制背景
          drawBackground(ctx, width, height, theme);
          
          // 绘制内容
          drawMemoContent(ctx, memo, width, height, theme, customFont).then(() => {
            // 返回图片数据
            resolve(canvas.toDataURL('image/png', 0.9));
          }).catch(reject);
          
        } catch (error) {
          reject(error);
        }
      });
    }
    
    // 计算内容所需的高度
    function calculateContentHeight(ctx, memo, width, customFont) {
      const padding = 30;
      const contentWidth = width - padding * 2;
      let totalHeight = padding + 20; // 初始padding

      // 角色头像拍立得高度
      totalHeight += 150; // 拍立得高度

      // 设置字体以准确计算
      ctx.font = `12px "${customFont}", serif`;
      totalHeight += 15; // 时间行高度
      totalHeight += 25; // 时间到标题的间距

      // 计算标题高度
      if (memo.title && memo.title.trim()) {
        ctx.font = `bold 20px "${customFont}", serif`;
        const titleLines = wrapText(ctx, memo.title.trim(), contentWidth);
        totalHeight += titleLines.length * 26 + 15;
      }

      // 装饰线
      totalHeight += 20;

      // "摘录"标签
      totalHeight += 18;

      // 计算原文高度
      ctx.font = `18px "${customFont}", serif`;
      const originalLines = wrapText(ctx, memo.originalText, contentWidth - 30);
      totalHeight += originalLines.length * 24 + 25; // 内容 + 引号空间 + 间距

      // 分隔线
      totalHeight += 20;

      // 只有当有笔记内容时才计算笔记相关高度
      if (memo.content && memo.content.trim()) {
        // "笔记"标签
        totalHeight += 15;

        // 计算注释高度
        ctx.font = `16px "${customFont}", serif`;
        const contentLines = wrapText(ctx, memo.content, contentWidth);
        totalHeight += contentLines.length * 22 + 15; // 内容 + 间距（更紧凑）

        // 到底部装饰的间距
        totalHeight += 8;
      }

      // 底部装饰
      totalHeight += 12; // 标语高度
      totalHeight += 10; // 最终底部间距

      return totalHeight;
    }
    
    // 绘制背景
    function drawBackground(ctx, width, height, theme) {
      // 创建温暖的渐变背景
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      const colors = theme.background.colors;
    
      // 动态添加渐变色，根据颜色数量平均分布
      colors.forEach((color, index) => {
        const position = index / (colors.length - 1);
        gradient.addColorStop(position, color);
      });
    
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    
    // 绘制Memo内容
    function drawMemoContent(ctx, memo, width, height, theme, customFont) {
      return new Promise((resolve) => {
        // 尝试加载平方工字体（如果尚未加载）
        if (!document.getElementById('ping-fang-gong-zi-ti-style')) {
          try {
            const pingFangGongZiTiStyle = document.createElement('style');
            pingFangGongZiTiStyle.id = 'ping-fang-gong-zi-ti-style';
            pingFangGongZiTiStyle.textContent = `
              @import url("https://fontsapi.zeoseven.com/494/main/result.css");
            `;
            document.head.appendChild(pingFangGongZiTiStyle);
            console.log('Memo: 平方工字体样式已添加');
          } catch (e) {
            console.warn('Memo: 添加平方工字体失败:', e);
          }
        }
        
        const padding = 30;
        const contentWidth = width - padding * 2;
        let currentY = padding + 20;

        // 设置默认字体和颜色
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        // 0. 绘制角色头像拍立得（左上角）
        try {
          let charName = 'Character';

          // 尝试使用TavernHelper获取角色名
          if (window.TavernHelper && window.TavernHelper.substitudeMacros) {
            try {
              const charMacro = window.TavernHelper.substitudeMacros('{{char}}');
              if (charMacro && charMacro !== '{{char}}') charName = charMacro;
            } catch (e) {
              // 如果宏替换失败，尝试其他方法
              charName = getCharacterName();
            }
          } else {
            // 如果没有TavernHelper，使用备用方法
            charName = getCharacterName();
          }

          // 拍立得效果的简单实现
          const polaroidWidth = 110;  // 拍立得宽度
          const polaroidHeight = 165; // 拍立得高度
          const polaroidX = padding + 10;
          const polaroidY = currentY;
          const whiteBorder = 10;     // 白色边框宽度
          
          // 保存当前状态
          ctx.save();
          
          // 添加轻微的旋转效果（-3度）
          ctx.translate(polaroidX + polaroidWidth/2, polaroidY + polaroidHeight/2);
          ctx.rotate(-3 * Math.PI / 180);
          ctx.translate(-(polaroidX + polaroidWidth/2), -(polaroidY + polaroidHeight/2));
          
          // 绘制拍立得白色背景（带阴影）
          ctx.shadowColor = 'rgba(0,0,0,0.2)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(polaroidX, polaroidY, polaroidWidth, polaroidHeight);
          
          // 移除阴影效果，绘制照片区域
          ctx.shadowColor = 'transparent';
          
          // 定义照片区域
          const photoWidth = polaroidWidth - whiteBorder * 2;
          const photoHeight = polaroidHeight - whiteBorder * 2 - 20; // 留出20px的空间放名字
          const photoX = polaroidX + whiteBorder;
          const photoY = polaroidY + whiteBorder;
          
          // 绘制照片背景（灰色占位）
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(photoX, photoY, photoWidth, photoHeight);
          
          // 尝试获取角色头像
          let charImageUrl = null;
          if (window.parent && window.parent.TavernHelper && window.parent.TavernHelper.getCharAvatarPath) {
            try {
              charImageUrl = window.parent.TavernHelper.getCharAvatarPath();
            } catch (e) {
              console.warn('Memo: 获取角色头像失败:', e);
            }
          }
          
          // 如果有头像，绘制头像
          if (charImageUrl) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = function() {
              // 计算等比例缩放尺寸，避免拉伸
              const photoAreaWidth = photoWidth;
              const photoAreaHeight = photoHeight;
              
              // 优化缩放逻辑，确保竖向比例区域被充分利用
              const imgRatio = img.width / img.height;
              const areaRatio = photoAreaWidth / photoAreaHeight;
              
              // 优先确保高度能完全展示，然后收缩宽度
              let scale;
              if (imgRatio <= areaRatio) {
                // 图片比例更窄，以高度为准
                scale = photoAreaHeight / img.height;
              } else {
                // 图片比例更宽，以宽度为准
                scale = photoAreaWidth / img.width;
              }
              const drawWidth = img.width * scale;
              const drawHeight = img.height * scale;
              
              // 居中显示
              const offsetX = (photoAreaWidth - drawWidth) / 2;
              const offsetY = (photoAreaHeight - drawHeight) / 2;
              
              console.log('Memo: 图片尺寸', img.width, 'x', img.height, '缩放比例', scale, 
                          '绘制尺寸', drawWidth, 'x', drawHeight);
              
              // 绘制图片到照片区域（等比例缩放并居中）
              ctx.drawImage(
                img, 
                photoX + offsetX, 
                photoY + offsetY, 
                drawWidth, 
                drawHeight
              );
              
              // 绘制角色名称 - 位于照片下方
              ctx.font = `bold 14px "${customFont}", sans-serif`;
              ctx.fillStyle = '#333333';
              ctx.textAlign = 'center';
              ctx.fillText(charName, polaroidX + polaroidWidth/2, polaroidY + photoHeight + whiteBorder + 15);
              
              // 恢复状态
              ctx.restore();
              
              // 继续绘制其他内容
              continueDrawing();
            };
            img.onerror = function() {
              console.warn('Memo: 加载角色头像失败');
              // 绘制角色名称
              ctx.font = `bold 14px "${customFont}", sans-serif`;
              ctx.fillStyle = '#333333';
              ctx.textAlign = 'center';
              ctx.fillText(charName, polaroidX + polaroidWidth/2, polaroidY + photoHeight + whiteBorder + 15);
              
              // 恢复状态
              ctx.restore();
              
              // 继续绘制其他内容
              continueDrawing();
            };
            img.src = charImageUrl;
          } else {
            // 如果没有头像，只绘制角色名称
            ctx.font = `bold 14px "${customFont}", sans-serif`;
            ctx.fillStyle = '#333333';
            ctx.textAlign = 'center';
            ctx.fillText(charName, polaroidX + polaroidWidth/2, polaroidY + photoHeight + whiteBorder + 15);
            
            // 恢复状态
            ctx.restore();
            
            // 继续绘制其他内容
            continueDrawing();
          }
        } catch (e) {
          console.warn('Memo: 绘制角色头像拍立得失败:', e);
          // 继续绘制其他内容
          continueDrawing();
        }
        
        function continueDrawing() {
          // 更新当前Y坐标，为其他内容留出空间
          currentY += 170; // 与拍立得高度一致
          
          // 0.5. 绘制楼层信息（如果有的话）
          if (memo.floorLabel && memo.floorLabel !== '手动创建') {
            ctx.font = `11px "${customFont}", serif`;
            ctx.fillStyle = theme.colors.userInfo;
            ctx.textAlign = 'right';
            ctx.fillText(`来自 ${memo.floorLabel}`, width - padding, currentY - 100);
          }

          // 1. 绘制时间
          const timeText = new Date(memo.updatedAt || memo.createdAt).toLocaleString('zh-CN');
          ctx.font = `12px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.time;
          ctx.textAlign = 'right';
          ctx.fillText(timeText, width - padding, currentY);

          currentY += 25;

          // 2. 绘制标题（如果有）
          ctx.textAlign = 'left';
          if (memo.title && memo.title.trim()) {
            ctx.font = `bold 20px "${customFont}", serif`;
            ctx.fillStyle = theme.colors.title;

            const titleLines = wrapText(ctx, memo.title.trim(), contentWidth);
            titleLines.forEach(line => {
              if (line.trim() === '') {
                // 空行也要占位
                currentY += 26;
              } else {
                ctx.fillText(line, padding, currentY);
                currentY += 26;
              }
            });

            currentY += 15;
          }

          // 3. 绘制装饰线
          ctx.strokeStyle = theme.colors.decorativeLine;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(padding, currentY);
          ctx.lineTo(padding + 40, currentY);
          ctx.stroke();

          currentY += 20;

          // 4. 绘制原文段落（突出显示）
          // 添加"摘录"标签
          ctx.font = `14px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.accent;
          ctx.fillText('摘录', padding, currentY);
          currentY += 18;

          ctx.font = `18px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.excerpt;

          // 添加引号
          ctx.font = `bold 24px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.accent;
          ctx.fillText('"', padding, currentY);

          currentY += 5;

          // 原文内容
          ctx.font = `18px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.excerpt;

          const originalLines = wrapText(ctx, memo.originalText, contentWidth - 30);
          originalLines.forEach(line => {
            if (line.trim() === '') {
              // 空行也要占位
              currentY += 24;
            } else {
              ctx.fillText(line, padding + 15, currentY);
              currentY += 24;
            }
          });

          // 结束引号
          ctx.font = `bold 24px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.accent;
          ctx.fillText('"', width - padding - 15, currentY - 24);

          currentY += 20;

          // 5. 绘制分隔线
          ctx.strokeStyle = theme.colors.separatorLine;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padding + 15, currentY);
          ctx.lineTo(width - padding - 15, currentY);
          ctx.stroke();

          currentY += 20;

          // 6. 绘制注释内容（只有当有笔记内容时才绘制）
          if (memo.content && memo.content.trim()) {
            // 添加"笔记"标签
            ctx.font = `14px "${customFont}", serif`;
            ctx.fillStyle = theme.colors.accent;
            ctx.fillText('笔记', padding, currentY);
            currentY += 15;

            ctx.font = `16px "${customFont}", serif`;
            ctx.fillStyle = theme.colors.notes;

            const contentLines = wrapText(ctx, memo.content, contentWidth);
            contentLines.forEach(line => {
              if (line.trim() === '') {
                // 空行也要占位
                currentY += 22;
              } else {
                ctx.fillText(line, padding, currentY);
                currentY += 22;
              }
            });

            // 添加一点间距到底部装饰
            currentY += 8;
          }

          // 小标语
          ctx.font = `12px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.brand;
          ctx.textAlign = 'center';
          ctx.fillText('- 来自酒馆Memo -', width / 2, currentY + 16);

          // 更新currentY到标语之后，确保有足够的底部间距
          currentY += 10;

          resolve();
        }
      });
    }
    
    // 文本换行函数
    function wrapText(ctx, text, maxWidth) {
      // 首先按照用户的换行符分割
      const userLines = text.split(/\r?\n/);
      const lines = [];
    
      // 对每一行进行自动换行处理
      userLines.forEach(userLine => {
        if (userLine.trim() === '') {
          // 空行也要保留
          lines.push('');
          return;
        }
    
        const chars = userLine.split('');
        let currentLine = '';
    
        for (let i = 0; i < chars.length; i++) {
          const char = chars[i];
          const testLine = currentLine + char;
          const testWidth = ctx.measureText(testLine).width;
    
          if (testWidth > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = char;
          } else {
            currentLine = testLine;
          }
        }
    
        if (currentLine !== '') {
          lines.push(currentLine);
        }
      });
    
      return lines;
    }
    
    function clearCurrentChatMemos() {
      if (!confirm('⚠️警告：此操作将删除当前聊天的所有Memo，且无法恢复！\n\n确定要继续吗？')) {
        return;
      }
    
      try {
        // 确定要使用的聊天上下文 - 优先使用手动选择的上下文
        const clearContext = state.selectedChatContext || getCurrentChatContext();
        if (!clearContext) {
          toastr.error('无法获取当前聊天信息！');
          return;
        }
    
        // 获取当前聊天的存储键
        const storageKey = getStorageKey(clearContext);
    
        // 获取当前聊天的Memo数量
        const currentMemos = loadMemosFromStorage(clearContext);
        const memoCount = currentMemos.length;
    
        // 删除当前聊天的Memo数据
        localStorage.removeItem(storageKey);
    
        toastr.success(`已清空当前聊天的Memo！共删除了 ${memoCount} 条Memo。`);
    
        // 刷新当前显示
        renderMemoList();
      } catch (error) {
        console.error('Memo: 清空当前聊天Memo失败:', error);
        toastr.error('清空操作失败，请重试！');
      }
    }
    
    // 绑定按钮事件，只有点击按钮时才初始化memo系统
    eventOnButton('显示Memo', function () {
      console.log('显示memo按钮被点击');
    
      // 启动消息观察器，显示小铅笔按钮
      initMessageObserver();
    
      // 如果控制面板不存在，创建它；如果存在，重新定位
      if (!selectionState.controlPanel) {
        createControlPanel();
      } else {
        positionControlPanel();
      }
    
      // 显示成功提示（如果toastr可用）
      if (typeof toastr !== 'undefined') {
        toastr.success('Memo已开启');
      }
    });
    
    // 停止memo系统的函数
    function stopMemo() {
      try {
        console.log('正在隐藏段落注释按钮...');
    
        // 1. 退出多选模式并清理状态
        if (selectionState.isMultiSelectMode) {
          selectionState.isMultiSelectMode = false;
          clearAllSelections();
        }
    
        // 2. 移除控制面板
        removeControlPanel();
    
        // 3. 移除多选模式样式
        const chatContainer = MemoDoc.querySelector('#chat') ||
          MemoDoc.querySelector('.chat-container') ||
          MemoDoc.querySelector('[id*="chat"]');
        if (chatContainer) {
          chatContainer.classList.remove('memo-multi-select-mode');
        }
    
        // 4. 停止消息观察器（不再监听新消息并添加按钮）
        stopMessageObserver();
    
        // 5. 移除所有现有的段落按钮
        const annotationButtons = MemoDoc.querySelectorAll('.memo-annotation-btn');
        annotationButtons.forEach(button => {
          if (button.parentNode) {
            button.parentNode.removeChild(button);
          }
        });
    
        // 6. 清理段落选中样式
        const selectedParagraphs = MemoDoc.querySelectorAll('.memo-paragraph-selected');
        selectedParagraphs.forEach(paragraph => {
          paragraph.classList.remove('memo-paragraph-selected');
        });
    
        // 7. 清理窗口事件监听器
        window.removeEventListener('resize', positionControlPanel);
    
        console.log('段落注释按钮已隐藏');
    
        // 显示成功提示（如果toastr可用）
        if (typeof toastr !== 'undefined') {
          toastr.success('Memo已关闭');
        }
    
      } catch (error) {
        console.error('Memo: 隐藏段落按钮时出错:', error);
        if (typeof toastr !== 'undefined') {
          toastr.error('关闭段落注释时出现错误');
        }
      }
    }
    
    // 创建多选控制面板
    function createControlPanel() {
      if (selectionState.controlPanel) {
        console.log('Memo: 控制面板已存在，跳过创建');
        return; // 避免重复创建
      }
    
      try {
        console.log('Memo: 开始创建控制面板...');
    
        const panel = MemoDoc.createElement('div');
        panel.className = 'memo-control-panel';
        panel.innerHTML = `
          <button id="memoToggleMultiSelect" class="memo-control-btn">开启多选</button>
          <button id="memoCloseButton" class="memo-control-btn secondary">关闭Memo</button>
          <button id="memoSelectAllBetween" class="memo-control-btn" style="display: none;">全选中间</button>
          <button id="memoCompleteSelection" class="memo-control-btn secondary" style="display: none;">完成选择 (0)</button>
        `;
    
        // 添加到文档
        MemoDoc.body.appendChild(panel);
        selectionState.controlPanel = panel;
    
        console.log('Memo: 控制面板DOM元素已创建并添加到页面');
    
        // 动态定位面板
        positionControlPanel();
    
        // 绑定事件
        const toggleBtn = panel.querySelector('#memoToggleMultiSelect');
        const closeBtn = panel.querySelector('#memoCloseButton');
        const selectAllBtn = panel.querySelector('#memoSelectAllBetween');
        const completeBtn = panel.querySelector('#memoCompleteSelection');
    
        if (toggleBtn && closeBtn && selectAllBtn && completeBtn) {
          toggleBtn.addEventListener('click', toggleMultiSelectMode);
          closeBtn.addEventListener('click', function() {
            console.log('关闭memo按钮被点击');
            stopMemo();
          });
          selectAllBtn.addEventListener('click', selectAllBetween);
          completeBtn.addEventListener('click', completeSelection);
          console.log('Memo: 控制面板事件绑定成功');
        } else {
          console.error('Memo: 控制面板按钮元素未找到！');
        }
    
        // 强制显示面板，防止被其他CSS覆盖
        setTimeout(() => {
          if (selectionState.controlPanel) {
            // 查找参照元素 - SillyTavern的输入框
            const sendForm = MemoDoc.querySelector('#send_form');
    
            if (sendForm) {
              const sendFormRect = sendForm.getBoundingClientRect();
    
              // 计算控制面板位置：在输入框上方15px，水平居中，更贴近输入框
              const panelWidth = 340; // 增加宽度以适应新增的全选按钮
              const leftPosition = sendFormRect.left + (sendFormRect.width - panelWidth) / 2;
              const topPosition = sendFormRect.top - 60; // 在输入框上方60px（面板高度约45px + 15px间距）
    
              console.log('Memo: 参照元素信息:', {
                sendFormRect: {
                  top: sendFormRect.top,
                  left: sendFormRect.left,
                  width: sendFormRect.width,
                  height: sendFormRect.height
                },
                计算位置: {
                  leftPosition,
                  topPosition,
                  panelWidth,
                  间距: '15px'
                }
              });
    
              // 使用相对定位
              selectionState.controlPanel.style.cssText = `
                position: fixed !important;
                top: ${topPosition}px !important;
                left: ${leftPosition}px !important;
                width: ${panelWidth}px !important;
                margin: 0 !important;
                transform: none !important;
                z-index: 9999 !important;
                display: flex !important;
                visibility: visible !important;
                opacity: 1 !important;
                background: var(--SmartThemeBlurTintColor, rgba(0, 0, 0, 0.4)) !important;
                color: var(--SmartThemeBodyColor, #e0e0e0) !important;
                padding: 6px 10px !important;
                border-radius: 12px !important;
                border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.15)) !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
                backdrop-filter: blur(16px) !important;
                min-height: 40px !important;
                gap: 6px !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 12px !important;
                font-weight: 500 !important;
              `;
    
            } else {
              console.warn('Memo: 未找到send_form元素，使用备用定位');
    
              // 备用方案：尝试查找其他已知元素
              const altElements = [
                '#send_textarea',
                '#rightSendForm',
                '#leftSendForm',
                '#extensionsMenuButton'
              ];
    
              let referenceElement = null;
              for (const selector of altElements) {
                referenceElement = MemoDoc.querySelector(selector);
                if (referenceElement) {
                  console.log(`Memo: 找到备用参照元素: ${selector}`);
                  break;
                }
              }
    
              if (referenceElement) {
                const refRect = referenceElement.getBoundingClientRect();
                const panelWidth = 340; // 与主方案保持一致，增加宽度以适应全选按钮
                const leftPosition = Math.max(10, refRect.left + (refRect.width - panelWidth) / 2);
                const topPosition = refRect.top - 60; // 改为60px，更贴近参照元素
    
                selectionState.controlPanel.style.cssText = `
                  position: fixed !important;
                  top: ${topPosition}px !important;
                  left: ${leftPosition}px !important;
                  width: ${panelWidth}px !important;
                  z-index: 9999 !important;
                  display: flex !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                  background: var(--SmartThemeBlurTintColor, rgba(0, 0, 0, 0.4)) !important;
                  color: var(--SmartThemeBodyColor, #e0e0e0) !important;
                  padding: 6px 10px !important;
                  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.15)) !important;
                  border-radius: 12px !important;
                  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
                  backdrop-filter: blur(16px) !important;
                  min-height: 40px !important;
                  gap: 6px !important;
                  align-items: center !important;
                  justify-content: center !important;
                  font-size: 12px !important;
                  font-weight: 500 !important;
                `;
    
                console.log('Memo: 使用备用元素定位，主题色样式');
              } else {
                console.error('Memo: 所有参照元素都未找到，使用屏幕中央');
                // 最终备用方案：屏幕中央
                selectionState.controlPanel.style.cssText = `
                  position: fixed !important;
                  top: 50% !important;
                  left: 50% !important;
                  width: 340px !important;
                  height: 80px !important;
                  margin-left: -170px !important;
                  margin-top: -40px !important;
                  z-index: 9999 !important;
                  display: flex !important;
                  visibility: visible !important;
                  opacity: 1 !important;
                  background: red !important;
                  color: white !important;
                  padding: 20px !important;
                  border: 5px solid lime !important;
                  border-radius: 10px !important;
                  align-items: center !important;
                  justify-content: center !important;
                  text-align: center !important;
                `;
              }
            }
    
            // 检查最终结果
            setTimeout(() => {
              const finalRect = selectionState.controlPanel.getBoundingClientRect();
              console.log('Memo: 控制面板最终位置:', {
                top: finalRect.top,
                left: finalRect.left,
                width: finalRect.width,
                height: finalRect.height,
                visible: finalRect.width > 0 && finalRect.height > 0 && finalRect.top >= 0 && finalRect.left >= 0,
                在视口内: finalRect.top >= 0 && finalRect.left >= 0 && finalRect.bottom <= window.innerHeight && finalRect.right <= window.innerWidth
              });
            }, 200);
    
            console.log('Memo: 控制面板已相对于输入框定位');
          } else {
            console.error('Memo: selectionState.controlPanel 为 null');
          }
        }, 100);
    
      } catch (error) {
        console.error('Memo: 创建控制面板失败:', error);
      }
    }
    
    // 动态定位控制面板
    function positionControlPanel() {
      if (!selectionState.controlPanel) return;
    
      try {
        // 使用最简单的CSS定位，避免复杂计算
        selectionState.controlPanel.style.cssText = `
          position: fixed !important;
          bottom: 100px !important;
          left: 50% !important;
          width: 340px !important;
          margin-left: -170px !important;
          transform: none !important;
          z-index: 9999 !important;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          background: var(--SmartThemeBlurTintColor, rgba(0, 0, 0, 0.4)) !important;
          color: var(--SmartThemeBodyColor, #e0e0e0) !important;
          padding: 6px 10px !important;
          border-radius: 12px !important;
          border: none !important;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
          backdrop-filter: blur(16px) !important;
          min-height: 40px !important;
          gap: 6px !important;
          animation: none !important;
          transition: none !important;
          top: auto !important;
          pointer-events: auto !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 12px !important;
          font-weight: 500 !important;
        `;
    
        console.log('Memo: 控制面板使用简化定位');
    
      } catch (error) {
        console.error('Memo: 定位控制面板时出错:', error);
      }
    }
    
    // 移除控制面板
    function removeControlPanel() {
      if (selectionState.controlPanel && selectionState.controlPanel.parentNode) {
        selectionState.controlPanel.parentNode.removeChild(selectionState.controlPanel);
        selectionState.controlPanel = null;
      }
    }
    
    // 切换多选模式
    function toggleMultiSelectMode() {
      selectionState.isMultiSelectMode = !selectionState.isMultiSelectMode;
    
      // 更新聊天容器样式
      const chatContainer = MemoDoc.querySelector('#chat') ||
        MemoDoc.querySelector('.chat-container') ||
        MemoDoc.querySelector('[id*="chat"]');
    
      if (chatContainer) {
        chatContainer.classList.toggle('memo-multi-select-mode', selectionState.isMultiSelectMode);
      }
    
      // 更新控制面板按钮
      const toggleBtn = selectionState.controlPanel?.querySelector('#memoToggleMultiSelect');
      const closeBtn = selectionState.controlPanel?.querySelector('#memoCloseButton');
      const selectAllBtn = selectionState.controlPanel?.querySelector('#memoSelectAllBetween');
      const completeBtn = selectionState.controlPanel?.querySelector('#memoCompleteSelection');
    
      if (toggleBtn && closeBtn && selectAllBtn && completeBtn) {
        if (selectionState.isMultiSelectMode) {
          toggleBtn.textContent = '退出多选';
          closeBtn.style.display = 'none'; // 多选模式下隐藏关闭按钮
          completeBtn.style.display = 'block';
          // 全选按钮暂时隐藏，由updateSelectAllButton函数控制显示
          selectAllBtn.style.display = 'none';
        } else {
          toggleBtn.textContent = '开启多选';
          closeBtn.style.display = 'block'; // 普通模式下显示关闭按钮
          selectAllBtn.style.display = 'none';
          completeBtn.style.display = 'none';
          // 清空选择
          clearAllSelections();
        }
      }
    
      // 更新所有现有的段落按钮
      updateAllAnnotationButtons();
      
      // 更新全选按钮状态
      if (selectionState.isMultiSelectMode) {
        updateSelectAllButton();
      }
    }
    
    // 切换段落选择状态
    function toggleParagraphSelection(paragraph, button) {
      const paragraphText = getPureTextContent(paragraph);
      if (!paragraphText) return;
    
      // 检查是否已选中
      const existingIndex = selectionState.selectedParagraphs.findIndex(p => p.element === paragraph);
    
      if (existingIndex >= 0) {
        // 取消选择
        selectionState.selectedParagraphs.splice(existingIndex, 1);
        paragraph.classList.remove('memo-paragraph-selected');
      } else {
        // 添加选择
        const messageId = getMessageId(paragraph);
    
        selectionState.selectedParagraphs.push({
          element: paragraph,
          text: paragraphText,
          messageId: messageId,
          timestamp: Date.now()
        });
        paragraph.classList.add('memo-paragraph-selected');
      }
    
      // 更新按钮样式
      updateButtonContent(button, paragraph);
    
      // 更新完成选择按钮
      updateCompleteButton();
    }
    
    // 更新所有段落按钮
    function updateAllAnnotationButtons() {
      const buttons = MemoDoc.querySelectorAll('.memo-annotation-btn');
      buttons.forEach(button => {
        const paragraph = button.parentElement;
        if (paragraph) {
          updateButtonContent(button, paragraph);
        }
      });
    }
    
    // 更新完成选择按钮
    function updateCompleteButton() {
      const completeBtn = selectionState.controlPanel?.querySelector('#memoCompleteSelection');
      if (completeBtn) {
        const count = selectionState.selectedParagraphs.length;
        completeBtn.textContent = `完成选择 (${count})`;
    
        if (count === 0) {
          // 没有选择时：暗淡且不可点击
          completeBtn.classList.add('secondary');
          completeBtn.disabled = true;
        } else {
          // 有选择时：高亮且可点击
          completeBtn.classList.remove('secondary');
          completeBtn.disabled = false;
        }
      }
      
      // 同时更新全选按钮状态
      updateSelectAllButton();
    }
    
    // 清空所有选择
    function clearAllSelections() {
      selectionState.selectedParagraphs.forEach(item => {
        item.element.classList.remove('memo-paragraph-selected');
      });
      selectionState.selectedParagraphs = [];
      updateAllAnnotationButtons();
      updateCompleteButton();
    }
    
    // 完成选择
    function completeSelection() {
      if (selectionState.selectedParagraphs.length === 0) {
        if (typeof toastr !== 'undefined') {
          toastr.warning('请先选择要创建Memo的段落');
        }
        return;
      }
    
      // 按DOM顺序排序选中的段落
      const sortedParagraphs = sortParagraphsByDOMOrder(selectionState.selectedParagraphs);
    
      // 合并文本，在最后加上可爱的✎符号
      const combinedText = sortedParagraphs.map(item => item.text).join('\n\n') + ' ✎';
    
      // 计算楼层信息
      const messageIds = sortedParagraphs
        .map(p => p.messageId)
        .filter(id => id !== null && id !== undefined);
    
      let messageId = null;
      let floorLabel = '未知楼层';
    
      if (messageIds.length > 0) {
        const uniqueMessageIds = [...new Set(messageIds)];
        if (uniqueMessageIds.length === 1) {
          // 同楼层
          messageId = uniqueMessageIds[0];
          floorLabel = generateFloorLabel(messageId);
        } else {
          // 跨楼层
          messageId = '-';
          floorLabel = '跨楼层';
        }
      }
    
      const sourceContext = {
        type: 'multi',
        messageId: messageId,
        floorLabel: floorLabel,
        selectedParagraphs: sortedParagraphs
      };
    
      // 退出多选模式
      toggleMultiSelectMode();
    
      // 打开创建Memo界面
      openAnnotationMemo(combinedText, sourceContext);
    }
    
    // 按DOM顺序排序段落
    function sortParagraphsByDOMOrder(paragraphs) {
      return paragraphs.sort((a, b) => {
        const position = a.element.compareDocumentPosition(b.element);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
          return -1; // a在b前面
        } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
          return 1;  // a在b后面
        }
        return 0; // 相同位置
      });
    }
    
    // 获取段落所属的消息ID（楼层号）
    function getMessageId(paragraph) {
      try {
        // 查找段落所属的消息容器（.mes是SillyTavern的标准消息容器）
        const messageElement = paragraph.closest('.mes');
        if (messageElement) {
          // 获取mesid属性，这就是message_id（楼层号）
          const messageId = messageElement.getAttribute('mesid');
          if (messageId) {
            return parseInt(messageId);
          }
        }
    
        // 备用方法：查找其他可能的消息容器
        const altMessageElement = paragraph.closest('[mesid], [data-message-id], [id*="mes_"]');
        if (altMessageElement) {
          const mesid = altMessageElement.getAttribute('mesid') ||
            altMessageElement.getAttribute('data-message-id') ||
            altMessageElement.id.replace(/^mes_/, '');
          if (mesid) {
            return parseInt(mesid);
          }
        }
    
        return null;
      } catch (e) {
        console.warn('Memo: 获取消息ID失败:', e);
        return null;
      }
    }
    
    // 生成楼层显示标签
    function generateFloorLabel(messageId) {
      if (messageId === null || messageId === undefined) {
        return '未知楼层';
      }
      if (messageId === '-') {
        return '跨楼层';
      }
      return `#${messageId}楼`;
    }
    
    // 获取段落的纯净文本内容（排除按钮元素）
    function getPureTextContent(paragraph) {
      // 克隆段落元素，避免影响原始DOM
      const clonedParagraph = paragraph.cloneNode(true);
    
      // 移除克隆中的所有按钮元素
      const buttons = clonedParagraph.querySelectorAll('.memo-annotation-btn');
      buttons.forEach(button => {
        button.remove();
      });
    
      // 返回纯净的文本内容
      return clonedParagraph.textContent?.trim() || '';
    }
    
    // 显示带样式选择器的图片预览
    
    function showImagePreviewWithStyleSelector(imageDataUrl, memo, currentStyle) {
    // 更新样式选择器，添加保存的配色方案
function updateStyleSelector(selector, currentStyle) {
  // 确保 state.savedColorSchemes 已初始化
  if (!state.savedColorSchemes) {
    state.savedColorSchemes = loadSavedColorSchemes() || {};
  }
  
  // 基本样式选项
  const baseOptions = [
    { value: 'summer', name: '长夏', description: '绿色' },
    { value: 'papper', name: '如是说', description: '信纸' },
    { value: 'marshmallow', name: '棉花糖', description: '粉蓝' },
    { value: 'rose', name: '朱砂痣', description: '朱红' },
    { value: 'drowninlove', name: '泥沼中', description: '青黑' },
    { value: 'ink', name: '缓缓', description: '淡墨' },
    { value: 'custom', name: '自定义配色', description: '个性化' }
  ];
  
  // 加载保存的配色方案
  loadSavedColorSchemes();
  
  // 创建选项HTML
  let optionsHtml = baseOptions.map(option => 
    `<option value="${option.value}" ${option.value === currentStyle ? 'selected' : ''}>
      ${option.name} - ${option.description}
    </option>`
  ).join('');
  
  // 如果有保存的配色方案，添加分隔符和保存的方案
  if (Object.keys(state.savedColorSchemes).length > 0) {
    optionsHtml += `<option disabled>──────────</option>`;
    
    // 添加保存的配色方案
    for (const [name, scheme] of Object.entries(state.savedColorSchemes)) {
      const schemeValue = `saved:${name}`;
      optionsHtml += `<option value="${schemeValue}" ${schemeValue === currentStyle ? 'selected' : ''}>
        ${name} - 保存的配色
      </option>`;
    }
  }
  
  // 更新选择器
  selector.innerHTML = optionsHtml;
}
    
      // 设置当前视图状态
      state.currentView = 'preview-with-selector';
    
      modalTitleElement.textContent = '分享图片';
    
      // 样式选项定义
      const styleOptions = [
        { value: 'summer', name: '长夏', description: '绿色' },
        { value: 'papper', name: '如是说', description: '信纸' },
        { value: 'marshmallow', name: '棉花糖', description: '粉蓝' },
        { value: 'rose', name: '朱砂痣', description: '朱红' },
        { value: 'drowninlove', name: '泥沼中', description: '青黑' },
        { value: 'ink', name: '缓缓', description: '淡墨' },
        { value: 'custom', name: '自定义配色', description: '个性化' }
      ];
      

    
      // 创建字体选项列表 - 只保留默认字体和已加载的网络字体
      const fontOptions = [
        { value: 'QiushuiShotai', name: '秋水书体', description: '默认' }
      ];
      
      // 添加已加载的网络字体
      for (const fontName of state.fontConfig.loadedFonts) {
        if (fontName !== 'QiushuiShotai') {
          fontOptions.push({
            value: fontName,
            name: fontName,
            description: '网络字体'
          });
        }
      }
    
      const html = `
        <div style="padding: 0 0 20px 0;">
          <!-- 样式和字体选择器 -->
          <div style="margin-bottom: 20px; display: flex; flex-direction: column; gap: 16px;">
            <!-- 样式选择器行 -->
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <label style="color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 14px; font-weight: 500; min-width: 80px;">
                卡片样式：
              </label>
              <select id="reportStyleSelector" style="
                padding: 8px 12px;
                border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                border-radius: 8px;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                color: var(--SmartThemeBodyColor, #ffffff);
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 160px;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                background-image: url(\"data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6,9 12,15 18,9'></polyline></svg>\");
                background-repeat: no-repeat;
                background-position: right 8px center;
                background-size: 16px;
                padding-right: 32px;
              ">
                <option value="summer" ${currentStyle === 'summer' ? 'selected' : ''}>长夏 - 绿色</option>
                <option value="marshmallow" ${currentStyle === 'marshmallow' ? 'selected' : ''}>棉花糖 - 粉蓝</option>
                <option value="drowninlove" ${currentStyle === 'drowninlove' ? 'selected' : ''}>泥沼中 - 青黑</option> 
                <option value="papper" ${currentStyle === 'papper' ? 'selected' : ''}>如是说 - 信纸</option>
                <option value="rose" ${currentStyle === 'rose' ? 'selected' : ''}>朱砂痣 - 朱红</option>
                <option value="ink" ${currentStyle === 'ink' ? 'selected' : ''}>缓缓 - 淡墨</option>
                <option value="custom" ${currentStyle === 'custom' ? 'selected' : ''}>自定义配色</option>
              </select>
              <button id="deleteStyleBtn" class="memo-action-button delete" style="height: 36px; padding: 0 8px; font-size: 12px;">删除</button>
            </div>
            
            <!-- 字体选择器行 -->
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <label style="color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 14px; font-weight: 500; min-width: 80px;">
                字体选择：
              </label>
              <select id="reportFontSelector" style="
                padding: 8px 12px;
                border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                border-radius: 8px;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                color: var(--SmartThemeBodyColor, #ffffff);
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                min-width: 160px;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                background-image: url(\"data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6,9 12,15 18,9'></polyline></svg>\");
                background-repeat: no-repeat;
                background-position: right 8px center;
                background-size: 16px;
                padding-right: 32px;
              ">
                ${fontOptions.map(option => `
                  <option value="${option.value}" ${option.value === state.fontConfig.currentFont ? 'selected' : ''}>
                    ${option.name} - ${option.description}
                  </option>
                `).join('')}
              </select>
            </div>
            
            <!-- CSS字体URL输入行 -->
            <div class="memo-form-group">
              <label class="memo-form-label">加载网络字体：</label>
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <input type="text" id="fontUrlInput" placeholder="输入CSS字体URL或@import链接..." style="
                  flex: 1;
                  min-width: 300px;
                  padding: 8px 12px;
                  border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                  border-radius: 6px;
                  background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                  color: var(--SmartThemeBodyColor, #ffffff);
                  font-size: 14px;
                  transition: all 0.3s ease;
                " />
                
                <button id="loadFontUrlBtn" style="
                  padding: 8px 16px;
                  background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.7));
                  color: var(--SmartThemeBodyColor, #ffffff);
                  border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.4));
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 14px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                  box-shadow: 0 2px 8px rgba(74, 158, 255, 0.15);
                  white-space: nowrap;
                ">
                  <i class="fas fa-link" style="margin-right: 6px; font-size: 12px;"></i>
                  加载字体
                </button>
              </div>
            </div>
            
            <!-- 重新生成按钮 -->
            <div style="display: flex; justify-content: center; margin-top: 8px;">
              <button id="regenerateImageBtn" class="memo-button secondary" style="min-width: 140px;">
                重新生成Memo
              </button>
            </div>
            
            <!-- 自定义配色配置区域 -->
            <div id="customColorConfigContainer" style="
              display: none;
              margin-top: 16px;
              padding: 16px;
              border: 2px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
              border-radius: 8px;
              background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
            ">
              <h4 style="margin: 0 0 12px 0; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.9)); font-size: 14px;">
                自定义配色设置
              </h4>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                <div>
                  <label style="display: block; margin-bottom: 4px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 12px;">
                    背景色1（左上）
                  </label>
                  <input type="color" id="customColor1" value="${state.customColorConfig.color1}" style="
                    width: 100%;
                    height: 36px;
                    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                    border-radius: 4px;
                    background: transparent;
                    cursor: pointer;
                  " />
                </div>
                <div>
                  <label style="display: block; margin-bottom: 4px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 12px;">
                    背景色2（右下）
                  </label>
                  <input type="color" id="customColor2" value="${state.customColorConfig.color2}" style="
                    width: 100%;
                    height: 36px;
                    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                    border-radius: 4px;
                    background: transparent;
                    cursor: pointer;
                  " />
                </div>
              </div>
              
              <div>
                <label style="display: block; margin-bottom: 4px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 12px;">
                  字体颜色
                </label>
                <input type="color" id="customFontColor" value="${state.customColorConfig.fontColor}" style="
                  width: 100%;
                  height: 36px;
                  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                  border-radius: 4px;
                  background: transparent;
                  cursor: pointer;
                " />
              </div>
              
              <div style="margin-top: 12px; text-align: center;">
                <button id="applyCustomColorsBtn" style="
                  padding: 6px 16px;
                  background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.7));
                  color: var(--SmartThemeBodyColor, #ffffff);
                  border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.4));
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 12px;
                  font-weight: 500;
                ">
                  应用配色
                </button>
              </div>
              
              <!-- 添加保存配色方案UI -->
              <div style="margin-top: 16px; border-top: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1)); padding-top: 16px;">
                <label style="display: block; margin-bottom: 8px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 12px;">
                  保存为配色方案
                </label>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="customColorSchemeName" placeholder="输入方案名称" style="
                    flex: 1;
                    padding: 6px 10px;
                    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                    border-radius: 4px;
                    background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                    color: var(--SmartThemeBodyColor, #ffffff);
                    font-size: 12px;
                  " />
                  <button id="saveColorSchemeBtn" style="
                    padding: 6px 12px;
                    background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.7));
                    color: var(--SmartThemeBodyColor, #ffffff);
                    border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.4));
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    white-space: nowrap;
                  ">
                    保存方案
                  </button>
                </div>
              </div>
            </div>
</div>
            </div>
          </div>
          
          <!-- 图片预览区域 -->
          <div id="imagePreviewContainer" style="
            text-align: center;
            max-height: 500px; 
            overflow: auto; 
            border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1)); 
            border-radius: 8px; 
            background: #fff; 
            padding: 10px;
            position: relative;
          ">
            <img id="previewImage" src="${imageDataUrl}" style="max-width: 100%; height: auto; border-radius: 4px;" alt="Memo图片" />
            
            <!-- 加载指示器 -->
            <div id="imageLoadingIndicator" style="
              display: none;
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(0, 0, 0, 0.7);
              color: white;
              padding: 10px 20px;
              border-radius: 8px;
              font-size: 14px;
            ">
              正在生成新图片...
            </div>
          </div>
        </div>
      `;
    
      modalBodyElement.innerHTML = html;
    
      // 绑定样式选择器事件
      const styleSelector = modalBodyElement.querySelector('#reportStyleSelector');
      const fontSelector = modalBodyElement.querySelector('#reportFontSelector');
      const previewImage = modalBodyElement.querySelector('#previewImage');
      const loadingIndicator = modalBodyElement.querySelector('#imageLoadingIndicator');

    // 更新样式选择器，添加保存的配色方案
updateStyleSelector(styleSelector, currentStyle);

      // 设置字体选择器样式
      addSelectFocusStyles('#reportStyleSelector');
      addSelectFocusStyles('#reportFontSelector');
    
      // 自动选择当前样式和字体
      const savedStyle = loadStylePreference();
      const savedFont = loadFontPreference();
      const targetStyle = currentStyle || savedStyle;
      const targetFont = savedFont || 'QiushuiShotai';
      
      styleSelector.value = targetStyle;
      fontSelector.value = targetFont;
    
// 样式选择器事件
styleSelector.addEventListener('change', (e) => {
  const newStyle = e.target.value;
  
  // 显示或隐藏自定义配色配置
  const customColorContainer = modalBodyElement.querySelector('#customColorConfigContainer');
  if (customColorContainer) {
    if (newStyle === 'custom') {
      customColorContainer.style.display = 'block';
    } else {
      customColorContainer.style.display = 'none';
    }
  }

  // 更新删除按钮状态
  const deleteStyleBtn = modalBodyElement.querySelector('#deleteStyleBtn');
  if (deleteStyleBtn) {
    if (newStyle.startsWith('saved:')) {
      deleteStyleBtn.disabled = false;
      deleteStyleBtn.style.opacity = '1';
      deleteStyleBtn.title = '删除该自定义样式';
    } else {
      deleteStyleBtn.disabled = true;
      deleteStyleBtn.style.opacity = '0.5';
      deleteStyleBtn.title = '默认样式不可删除';
    }
  }
  
  if (newStyle === currentStyle) return;

  // 处理保存的配色方案
  if (newStyle.startsWith('saved:')) {
    const schemeName = newStyle.replace('saved:', '');
    const scheme = state.savedColorSchemes[schemeName];
    
    if (scheme) {
      // 应用保存的配色
      state.customColorConfig = { ...state.customColorConfig, ...scheme };
      saveCustomColorConfig(state.customColorConfig);
    }
  }

  regenerateImageWithNewSettings(memo, newStyle, state.fontConfig.currentFont, previewImage, loadingIndicator, styleSelector, fontSelector);
});
    
      // 字体选择器事件
      fontSelector.addEventListener('change', (e) => {
        const newFont = e.target.value;
        saveFontPreference(newFont);
        
        const currentStyleValue = styleSelector.value;
        regenerateImageWithNewSettings(memo, currentStyleValue, newFont, previewImage, loadingIndicator, styleSelector, fontSelector);
      });
    
      // 重新生成按钮事件
      const regenerateBtn = modalBodyElement.querySelector('#regenerateImageBtn');
      if (regenerateBtn) {
        regenerateBtn.addEventListener('click', () => {
          const selectedStyle = styleSelector.value;
          const selectedFont = fontSelector.value;
          regenerateImageWithNewSettings(memo, selectedStyle, selectedFont, previewImage, loadingIndicator, styleSelector, fontSelector);
        });
      }
    
      // 自定义配色相关事件
      const customColorContainer = modalBodyElement.querySelector('#customColorConfigContainer');
      const customColor1 = modalBodyElement.querySelector('#customColor1');
      const customColor2 = modalBodyElement.querySelector('#customColor2');
      const customFontColor = modalBodyElement.querySelector('#customFontColor');
      const applyCustomColorsBtn = modalBodyElement.querySelector('#applyCustomColorsBtn');
    
      // 初始化自定义配色显示状态
      if (customColorContainer && styleSelector.value === 'custom') {
        customColorContainer.style.display = 'block';
      }
    
      // 应用自定义配色按钮事件
      if (applyCustomColorsBtn && customColor1 && customColor2 && customFontColor) {
        applyCustomColorsBtn.addEventListener('click', () => {
          // 更新自定义配色配置
          state.customColorConfig.color1 = customColor1.value;
          state.customColorConfig.color2 = customColor2.value;
          state.customColorConfig.fontColor = customFontColor.value;
          
          // 保存配置
          saveCustomColorConfig(state.customColorConfig);
          
          // 如果当前选择的是自定义配色，重新生成图片
          if (styleSelector.value === 'custom') {
            const selectedFont = fontSelector.value;
            regenerateImageWithNewSettings(memo, 'custom', selectedFont, previewImage, loadingIndicator, styleSelector, fontSelector);
          }
          
          toastr.success('自定义配色已应用！');
        });
      }

    // 保存配色方案按钮事件
    const customColorSchemeName = modalBodyElement.querySelector('#customColorSchemeName');
    const saveColorSchemeBtn = modalBodyElement.querySelector('#saveColorSchemeBtn');

    if (saveColorSchemeBtn && customColorSchemeName && customColor1 && customColor2 && customFontColor) {
      saveColorSchemeBtn.addEventListener('click', () => {
        const schemeName = customColorSchemeName.value.trim();
        
        if (!schemeName) {
          toastr.warning('请输入配色方案名称');
          return;
        }
        
        // 获取当前配色
        const colorScheme = {
          color1: customColor1.value,
          color2: customColor2.value,
          fontColor: customFontColor.value,
          textColors: { ...state.customColorConfig.textColors }
        };
        
        // 保存配色方案
        if (saveColorScheme(schemeName, colorScheme)) {
          toastr.success(`配色方案 "${schemeName}" 已保存`);
          customColorSchemeName.value = '';
          
          // 更新样式选择器
          updateStyleSelector(styleSelector, `saved:${schemeName}`);
          styleSelector.value = `saved:${schemeName}`;
          
          // 更新删除按钮状态
          const deleteStyleBtn = modalBodyElement.querySelector('#deleteStyleBtn');
          if (deleteStyleBtn) {
            deleteStyleBtn.disabled = false;
            deleteStyleBtn.style.opacity = '1';
            deleteStyleBtn.title = '删除该自定义样式';
          }
          
          // 重新生成图片
          regenerateImageWithNewSettings(memo, `saved:${schemeName}`, fontSelector.value, previewImage, loadingIndicator, styleSelector, fontSelector);
        } else {
          toastr.error('保存配色方案失败');
        }
      });
    }  
    
      // 渲染底部按钮
      modalFooterElement.innerHTML = '';
      modalFooterElement.appendChild(createButton('下载图片', 'primary', () => {
        const currentImageSrc = previewImage.src;
        const selectedStyle = styleSelector.value;
        downloadImageFromDataUrl(currentImageSrc, memo, selectedStyle);
      }));
      modalFooterElement.appendChild(createButton('返回列表', 'secondary', () => renderMemoList()));
   
      // 重新居中模态框
      requestAnimationFrame(() => {
        centerModal();
      });
    
      // CSS字体URL输入框和加载按钮事件
      const fontUrlInput = modalBodyElement.querySelector('#fontUrlInput');
      const loadFontUrlBtn = modalBodyElement.querySelector('#loadFontUrlBtn');
      
      // 为字体URL输入框添加焦点样式
      addSelectFocusStyles('#fontUrlInput');
      
      // 字体URL加载按钮事件
      if (loadFontUrlBtn && fontUrlInput) {
        loadFontUrlBtn.addEventListener('click', () => {
          const fontUrl = fontUrlInput.value.trim();
          if (fontUrl) {
            loadFontFromUrl(fontUrl, fontSelector);
          } else {
            toastr.warning('请输入字体URL或@import链接');
          }
        });
        
        // 支持回车键加载
        fontUrlInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            const fontUrl = fontUrlInput.value.trim();
            if (fontUrl) {
              loadFontFromUrl(fontUrl, fontSelector);
            }
          }
        });
        
        // 为输入框添加焦点样式
        fontUrlInput.addEventListener('focus', function () {
          this.style.borderColor = 'var(--SmartThemeQuoteColor, #4a9eff)';
          this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08))';
          this.style.boxShadow = '0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2))';
        });
        fontUrlInput.addEventListener('blur', function () {
          this.style.borderColor = 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';
          this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))';
          this.style.boxShadow = 'none';
        });
      }

    // 添加删除按钮事件监听
    const deleteStyleBtn = modalBodyElement.querySelector('#deleteStyleBtn');
    if (deleteStyleBtn) {
      // 初始化按钮状态
      if (styleSelector.value.startsWith('saved:')) {
        deleteStyleBtn.disabled = false;
        deleteStyleBtn.style.opacity = '1';
        deleteStyleBtn.title = '删除该自定义样式';
      } else {
        deleteStyleBtn.disabled = true;
        deleteStyleBtn.style.opacity = '0.5';
        deleteStyleBtn.title = '默认样式不可删除';
      }

      // 绑定点击事件
      deleteStyleBtn.addEventListener('click', function() {
        const val = styleSelector.value;
        if (!val.startsWith('saved:')) {
          toastr.warning('默认样式不可删除');
          return;
        }
        if (confirm('确定要删除该自定义样式吗？删除后不可恢复！')) {
          if (deleteCustomStyle(val)) {
            toastr.success('自定义样式已删除');
            // 刷新样式选择器
            updateStyleSelector(styleSelector, 'summer');
            styleSelector.value = 'summer';
            // 重新生成图片预览
            regenerateImageWithNewSettings(memo, 'summer', fontSelector.value, previewImage, loadingIndicator, styleSelector, fontSelector);
          } else {
            toastr.error('删除失败，可能该样式已不存在');
          }
        }
      });
    }
    }
    
    // 从DataURL下载图片的辅助函数
    function downloadImageFromDataUrl(dataUrl, memo, style) {
      try {
        // 生成更有意义的文件名
        const displayTitle = getDisplayTitle(memo);
        const safeTitle = displayTitle.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 20);
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:\-]/g, '');
        const fileName = `memo_usage_report_${timestamp}.png`;
    
        // 创建下载链接
        const link = MemoDoc.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
    
        // 触发下载
        MemoDoc.body.appendChild(link);
        link.click();
        MemoDoc.body.removeChild(link);
    
        toastr.success('图片已下载！');
        
        // 保存样式偏好
        saveStylePreference(style);
      } catch (error) {
        console.error('Memo: 下载图片失败:', error);
        toastr.error('下载失败，请重试');
      }
    }
    
    // 导入/导出功能
    function exportAllMemos() {
      try {
        // 收集所有memo数据
        const allData = {};
    
        // 遍历localStorage中所有以memo_开头的键
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
            try {
              const value = localStorage.getItem(key);
              if (value) {
                allData[key] = JSON.parse(value);
              }
            } catch (e) {
              console.error(`解析键 ${key} 的数据时出错:`, e);
            }
          }
        }
    
        // 添加元数据
        const exportData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          data: allData
        };
    
        // 转换为JSON字符串
        const jsonString = JSON.stringify(exportData, null, 2);
    
        // 创建Blob并下载
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:\-]/g, '');
    
        const a = MemoDoc.createElement('a');
        a.href = url;
        a.download = `memo_export_${timestamp}.json`;
        MemoDoc.body.appendChild(a);
        a.click();
    
        // 清理
        setTimeout(() => {
          MemoDoc.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 0);
    
        toastr.success('Memo数据导出成功！');
        return true;
      } catch (error) {
        console.error('导出Memo数据失败:', error);
        toastr.error('导出失败: ' + error.message);
        return false;
      }
    }
    
    function importMemos(fileContent, silent = false) {
      try {
        // 解析JSON数据
        const importData = JSON.parse(fileContent);
    
        // 基本验证
        if (!importData.version || !importData.data) {
          if (!silent) toastr.error('导入文件格式不正确！');
          return false;
        }
    
        // 确认导入（在静默模式下跳过确认）
        if (!silent && !confirm(`确定要导入数据吗？\n这将导入 ${Object.keys(importData.data).length} 个聊天的Memo数据。\n现有的同名数据将被覆盖！`)) {
          return false;
        }
    
        // 导入数据
        let importCount = 0;
        for (const key in importData.data) {
          if (key.startsWith(LOCAL_STORAGE_KEY_PREFIX)) {
            try {
              localStorage.setItem(key, JSON.stringify(importData.data[key]));
              importCount++;
            } catch (e) {
              console.error(`导入键 ${key} 时出错:`, e);
            }
          }
        }
    
        if (!silent) toastr.success(`成功导入 ${importCount} 个聊天的Memo数据！`);
    
        // 如果当前在列表视图，刷新显示
        if (state.currentView === 'list') {
          renderMemoList();
        }
    
        return true;
      } catch (error) {
        console.error('导入Memo数据失败:', error);
        if (!silent) toastr.error('导入失败: ' + error.message);
        return false;
      }
    }
    
    // GitHub配置相关函数
    function loadGitHubConfig() {
      try {
        const configStr = localStorage.getItem(GITHUB_CONFIG_KEY);
        if (configStr) {
          const config = JSON.parse(configStr);
          state.githubConfig = { ...state.githubConfig, ...config };
        }
      } catch (error) {
        console.error('加载GitHub配置失败:', error);
      }
    }
    
    function saveGitHubConfig(config) {
      try {
        // 更新状态
        state.githubConfig = { ...state.githubConfig, ...config };
        // 保存到localStorage
        localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(state.githubConfig));
        return true;
      } catch (error) {
        console.error('保存GitHub配置失败:', error);
        return false;
      }
    }
    
    // 样式偏好相关函数
    function loadStylePreference() {
      try {
        const styleStr = localStorage.getItem(STYLE_PREFERENCE_KEY);
        if (styleStr) {
          return styleStr;
        }
        return 'summer'; // 默认样式
      } catch (error) {
        console.error('加载样式偏好失败:', error);
        return 'summer';
      }
    }
    
    function saveStylePreference(style) {
      try {
        localStorage.setItem(STYLE_PREFERENCE_KEY, style);
        return true;
      } catch (error) {
        console.error('保存样式偏好失败:', error);
        return false;
      }
    }
    
    // 渲染GitHub设置界面
    function renderGitHubSettings() {
      // 设置当前视图状态
      state.currentView = 'github-settings';
    
      // 确保加载最新配置
      loadGitHubConfig();
    
      modalTitleElement.textContent = 'GitHub同步设置';
    
      const html = `
        <div class="memo-form">
          <div style="margin-bottom: 20px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7)); font-size: 14px; line-height: 1.5;">
            配置GitHub同步，将Memo数据备份到您的GitHub仓库（建议私有）。
            <br>需要一个具有至少Repo权限的GitHub个人访问令牌。
          </div>
          
          <div class="memo-form-group">
            <label class="memo-form-label" for="githubRepo">备份路径：</label>
            <input type="text" id="githubRepo" 
                   placeholder="格式：Github用户名/项目名，例如：username/memo-data" 
                   value="${escapeHtml(state.githubConfig.repo)}"
                   style="padding: 12px 16px;
                          border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                          border-radius: 10px;
                          background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                          color: var(--SmartThemeBodyColor, #ffffff);
                          font-size: 14px;
                          transition: all 0.3s ease;
                          font-weight: 500;
                          width: 100%;
                          box-sizing: border-box;" />
          </div>
          
          <div class="memo-form-group">
            <label class="memo-form-label" for="githubToken">个人访问令牌：<a href="https://github.com/settings/tokens" target="_blank" style="font-size: 12px; color: var(--SmartThemeQuoteColor, #4a9eff); text-decoration: underline; margin-left: 5px;">创建令牌</a></label>
            <input type="password" id="githubToken" 
                   placeholder="粘贴您的GitHub个人访问令牌" 
                   value="${escapeHtml(state.githubConfig.token)}"
                   style="padding: 12px 16px;
                          border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                          border-radius: 10px;
                          background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                          color: var(--SmartThemeBodyColor, #ffffff);
                          font-size: 14px;
                          transition: all 0.3s ease;
                          font-weight: 500;
                          width: 100%;
                          box-sizing: border-box;" />
          </div>
          
          <div class="memo-form-group">
            <label class="memo-form-label" for="githubBranch">分支名称（可选）：</label>
            <input type="text" id="githubBranch" 
                   placeholder="默认：main" 
                   value="${escapeHtml(state.githubConfig.branch)}"
                   style="padding: 12px 16px;
                          border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                          border-radius: 10px;
                          background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                          color: var(--SmartThemeBodyColor, #ffffff);
                          font-size: 14px;
                          transition: all 0.3s ease;
                          font-weight: 500;
                          width: 100%;
                          box-sizing: border-box;" />
          </div>
          
          <div class="memo-form-group">
            <label class="memo-form-label" for="githubPath">保存路径（可选）：</label>
            <input type="text" id="githubPath" 
                   placeholder="默认：memo-data" 
                   value="${escapeHtml(state.githubConfig.path)}"
                   style="padding: 12px 16px;
                          border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                          border-radius: 10px;
                          background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                          color: var(--SmartThemeBodyColor, #ffffff);
                          font-size: 14px;
                          transition: all 0.3s ease;
                          font-weight: 500;
                          width: 100%;
                          box-sizing: border-box;" />
          </div>
          
          <div class="memo-form-group">
            <label class="memo-form-label" for="githubFilename">自定义文件名（可选）：</label>
            <input type="text" id="githubFilename" 
                   placeholder="默认：自动生成时间戳文件名" 
                   value="${state.githubConfig.filename ? escapeHtml(state.githubConfig.filename) : ''}"
                   style="padding: 12px 16px;
                          border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                          border-radius: 10px;
                          background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                          color: var(--SmartThemeBodyColor, #ffffff);
                          font-size: 14px;
                          transition: all 0.3s ease;
                          font-weight: 500;
                          width: 100%;
                          box-sizing: border-box;" />
            <div style="margin-top: 5px; font-size: 12px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.5));">
              文件名将自动添加.json后缀，不需要包含路径
            </div>
          </div>
          
          <div style="display: flex; gap: 15px; margin-top: 20px;">
            <button id="githubSyncButton" class="memo-button primary" style="flex: 1; max-width: none; margin-top: 10px;">
              上传数据到GitHub
            </button>
            <button id="githubDownloadButton" class="memo-button secondary" style="flex: 1; max-width: none; margin-top: 10px;">
              从GitHub下载数据
            </button>
          </div>
          
          <div id="githubSyncStatus" style="
            margin-top: 15px;
            padding: 10px;
            border-radius: 8px;
            background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
            color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
            font-size: 12px;
            text-align: center;
            display: none;
          ">同步状态显示区域</div>
        </div>
      `;
    
      modalBodyElement.innerHTML = html;
    
      // 绑定输入框样式
      ['githubRepo', 'githubToken', 'githubBranch', 'githubPath', 'githubFilename'].forEach(id => {
        const input = MemoDoc.getElementById(id);
        if (input) {
          input.addEventListener('focus', function () {
            this.style.borderColor = 'var(--SmartThemeQuoteColor, #4a9eff)';
            this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08))';
            this.style.boxShadow = '0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2))';
          });
          input.addEventListener('blur', function () {
            this.style.borderColor = 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';
            this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))';
            this.style.boxShadow = 'none';
          });
        }
      });
    
      // 绑定按钮事件
      const syncButton = MemoDoc.getElementById('githubSyncButton');
      if (syncButton) {
        syncButton.addEventListener('click', () => {
          saveGitHubSettingsAndSync('upload');
        });
      }
    
      const downloadButton = MemoDoc.getElementById('githubDownloadButton');
      if (downloadButton) {
        downloadButton.addEventListener('click', () => {
          saveGitHubSettingsAndSync('download');
        });
      }
    
      // 渲染底部按钮
      modalFooterElement.innerHTML = '';
      modalFooterElement.appendChild(createButton('保存设置', 'primary', saveGitHubSettingsAndReturn));
      modalFooterElement.appendChild(createButton('返回', 'secondary', () => renderMemoList()));
    
      // 重新居中模态框
      requestAnimationFrame(() => {
        centerModal();
      });
    }
    
    // 保存GitHub设置并返回列表
    function saveGitHubSettingsAndReturn() {
      const repo = MemoDoc.getElementById('githubRepo')?.value?.trim() || '';
      const token = MemoDoc.getElementById('githubToken')?.value?.trim() || '';
      const branch = MemoDoc.getElementById('githubBranch')?.value?.trim() || 'main';
      const path = MemoDoc.getElementById('githubPath')?.value?.trim() || 'memo-data';
      const filename = MemoDoc.getElementById('githubFilename')?.value?.trim() || '';
    
      // 更新配置
      const config = {
        repo,
        token,
        branch,
        path,
        filename
      };
    
      if (saveGitHubConfig(config)) {
        toastr.success('GitHub设置已保存');
        renderMemoList();
      } else {
        toastr.error('保存设置失败');
      }
    }
    
    // 保存GitHub设置并执行同步
    function saveGitHubSettingsAndSync(action) {
      const repo = MemoDoc.getElementById('githubRepo')?.value?.trim() || '';
      const token = MemoDoc.getElementById('githubToken')?.value?.trim() || '';
      const branch = MemoDoc.getElementById('githubBranch')?.value?.trim() || 'main';
      const path = MemoDoc.getElementById('githubPath')?.value?.trim() || 'memo-data';
      const filename = MemoDoc.getElementById('githubFilename')?.value?.trim() || '';
    
      // 验证输入
      if (!repo || !token) {
        toastr.error('请填写备份路径和访问令牌');
        return;
      }
    
      // 验证仓库格式
      if (!repo.includes('/')) {
        toastr.error('备份路径格式不正确，应为：Github用户名/项目名');
        return;
      }
    
      // 更新配置
      const config = {
        repo,
        token,
        branch,
        path,
        filename
      };
    
      if (saveGitHubConfig(config)) {
        // 显示同步状态区域
        const statusElem = MemoDoc.getElementById('githubSyncStatus');
        if (statusElem) {
          statusElem.style.display = 'block';
          statusElem.textContent = '正在准备同步...';
        }
    
        // 执行同步操作
        if (action === 'upload') {
          uploadToGitHub(statusElem);
        } else if (action === 'download') {
          downloadFromGitHub(statusElem);
        }
      } else {
        toastr.error('保存设置失败');
      }
    }
    
    // 上传数据到GitHub
    async function uploadToGitHub(statusElem) {
      try {
        if (!state.githubConfig.repo || !state.githubConfig.token) {
          updateSyncStatus(statusElem, '❌ 缺少GitHub仓库信息或令牌', 'error');
          return;
        }
    
        updateSyncStatus(statusElem, '🔄 正在收集本地数据...', 'info');
    
        // 收集所有memo数据
        const allData = {};
        // 遍历localStorage中所有以memo_开头的键
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX) && key !== GITHUB_CONFIG_KEY) {
            try {
              const value = localStorage.getItem(key);
              if (value) {
                allData[key] = JSON.parse(value);
              }
            } catch (e) {
              console.error(`解析键 ${key} 的数据时出错:`, e);
            }
          }
        }
    
        // 添加元数据
        const exportData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          data: allData
        };
    
        // 转换为JSON字符串
        const jsonString = JSON.stringify(exportData, null, 2);
    
        // 生成时间戳（无论是否使用自定义文件名，都需要这个时间戳用于提交信息）
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:\-]/g, '');
    
        // 生成文件名
        let fileName;
        if (state.githubConfig.filename) {
          // 使用用户自定义的文件名
          fileName = state.githubConfig.filename.endsWith('.json') ?
            state.githubConfig.filename :
            `${state.githubConfig.filename}.json`;
        } else {
          // 使用默认的时间戳文件名
          fileName = `memo_data_${timestamp}.json`;
        }
        const filePath = `${state.githubConfig.path}/${fileName}`;
    
        updateSyncStatus(statusElem, '🔄 正在连接GitHub...', 'info');
    
        // GitHub API请求
        const [owner, repo] = state.githubConfig.repo.split('/');
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    
        // 准备请求头
        const headers = {
          'Authorization': `token ${state.githubConfig.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        };
    
        // 将内容编码为Base64
        const base64Content = btoa(unescape(encodeURIComponent(jsonString)));
    
        // 检查文件是否已存在
        let sha = null;
        try {
          const checkResponse = await fetch(apiUrl, {
            method: 'GET',
            headers: headers
          });
    
          if (checkResponse.ok) {
            // 文件已存在，获取其SHA值用于更新
            const fileData = await checkResponse.json();
            sha = fileData.sha;
            updateSyncStatus(statusElem, '🔄 文件已存在，准备更新...', 'info');
          }
        } catch (error) {
          // 忽略错误，表示文件可能不存在
          console.log('文件不存在或检查出错，将创建新文件');
        }
    
        // 准备请求体
        const requestBody = {
          message: `Update memo data: ${timestamp}`,
          content: base64Content,
          branch: state.githubConfig.branch
        };
    
        // 如果文件已存在，添加SHA以实现覆盖
        if (sha) {
          requestBody.sha = sha;
        }
    
        // 提交数据
        const response = await fetch(apiUrl, {
          method: 'PUT',
          headers: headers,
          body: JSON.stringify(requestBody)
        });
    
        const result = await response.json();
    
        if (response.ok) {
          // 更新最后同步时间
          saveGitHubConfig({
            lastSync: new Date().toISOString()
          });
          updateSyncStatus(statusElem, `✅ 上传成功! 文件已${sha ? '更新' : '保存'}为: ${fileName}`, 'success');
        } else {
          updateSyncStatus(statusElem, `❌ 上传失败: ${result.message || '未知错误'}`, 'error');
        }
      } catch (error) {
        console.error('上传到GitHub失败:', error);
        updateSyncStatus(statusElem, `❌ 上传出错: ${error.message || '未知错误'}`, 'error');
      }
    }
    
    // 从GitHub下载数据
    async function downloadFromGitHub(statusElem) {
      try {
        if (!state.githubConfig.repo || !state.githubConfig.token) {
          updateSyncStatus(statusElem, '❌ 缺少GitHub仓库信息或令牌', 'error');
          return;
        }
    
        updateSyncStatus(statusElem, '🔄 正在连接GitHub...', 'info');
    
        // GitHub API请求 - 获取目录内容
        const [owner, repo] = state.githubConfig.repo.split('/');
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${state.githubConfig.path}`;
    
        // 准备请求头
        const headers = {
          'Authorization': `token ${state.githubConfig.token}`,
          'Accept': 'application/vnd.github.v3+json'
        };
    
        // 获取目录列表
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: headers
        });
    
        if (!response.ok) {
          const errorData = await response.json();
          updateSyncStatus(statusElem, `❌ 获取文件列表失败: ${errorData.message || '未知错误'}`, 'error');
          return;
        }
    
        const files = await response.json();
    
        // 过滤所有JSON文件
        const jsonFiles = files.filter(file =>
          file.type === 'file' && file.name.endsWith('.json')
        );
    
        if (jsonFiles.length === 0) {
          updateSyncStatus(statusElem, '❌ 未找到备份数据文件', 'error');
          return;
        }
    
        // 如果指定了文件名，尝试查找对应文件
        let targetFile = null;
        if (state.githubConfig.filename) {
          const filename = state.githubConfig.filename.endsWith('.json') ?
            state.githubConfig.filename :
            `${state.githubConfig.filename}.json`;
    
          targetFile = jsonFiles.find(file => file.name === filename);
    
          // 如果指定了文件名但找不到文件，显示错误信息
          if (!targetFile) {
            updateSyncStatus(statusElem, `❌ 未找到指定的文件: ${filename}`, 'error');
            return;
          }
    
          // 找到了指定文件，直接下载
          updateSyncStatus(statusElem, `🔄 正在下载指定备份: ${targetFile.name}...`, 'info');
          await downloadAndImportFile(targetFile.path, targetFile.name, statusElem);
          return;
        }
    
        // 如果没有指定文件名，显示文件选择界面
        // 按文件名排序，最新的在前面
        jsonFiles.sort((a, b) => b.name.localeCompare(a.name));
    
        // 清空状态消息，显示文件选择界面
        if (statusElem) {
          statusElem.innerHTML = `
            <div style="text-align: left; margin-bottom: 10px;">请选择要下载的备份文件：</div>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1)); border-radius: 8px; padding: 8px; margin-bottom: 15px;">
              ${jsonFiles.map((file, index) => `
                <div class="github-file-item" style="
                  padding: 8px;
                  margin-bottom: 5px;
                  border-radius: 6px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                  transition: all 0.2s ease;
                ">
                  <div class="file-info" style="
                    flex: 1;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-right: 10px;
                  "
                  data-path="${file.path}"
                  data-name="${file.name}"
                  onmouseover="this.parentNode.style.background='var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08))'; this.parentNode.style.borderColor='var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.3))';" 
                  onmouseout="this.parentNode.style.background='var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))'; this.parentNode.style.borderColor='var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';"
                  >
                    <span style="font-weight: 500;">${file.name}</span>
                    <span style="font-size: 11px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.6));">
                      ${formatFileSize(file.size)}
                    </span>
                  </div>
                  <button class="delete-file-btn" style="
                    background: rgba(255, 71, 87, 0.2);
                    color: #ff4757;
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                  data-path="${file.path}"
                  data-sha="${file.sha}"
                  data-name="${file.name}"
                  onmouseover="this.style.background='rgba(255, 71, 87, 0.3)';" 
                  onmouseout="this.style.background='rgba(255, 71, 87, 0.2)';"
                  >
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
              `).join('')}
            </div>
          `;
    
          // 为文件项添加点击事件
          const fileItems = statusElem.querySelectorAll('.file-info');
          fileItems.forEach(item => {
            item.addEventListener('click', async () => {
              const path = item.getAttribute('data-path');
              const name = item.getAttribute('data-name');
              await downloadAndImportFile(path, name, statusElem);
            });
          });
    
          // 为删除按钮添加点击事件
          const deleteButtons = statusElem.querySelectorAll('.delete-file-btn');
          deleteButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
              e.stopPropagation(); // 防止触发父元素的点击事件
              const path = button.getAttribute('data-path');
              const sha = button.getAttribute('data-sha');
              const name = button.getAttribute('data-name');
    
              if (confirm(`确定要删除文件 "${name}" 吗？此操作不可恢复！`)) {
                await deleteGitHubFile(path, sha, statusElem);
              }
            });
          });
        }
      } catch (error) {
        console.error('从GitHub下载数据失败:', error);
        updateSyncStatus(statusElem, `❌ 下载出错: ${error.message || '未知错误'}`, 'error');
      }
    }
    
    // 格式化文件大小
    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      else return (bytes / 1048576).toFixed(1) + ' MB';
    }
    
    // 下载并导入文件
    async function downloadAndImportFile(pathOrUrl, fileName, statusElem) {
      try {
        updateSyncStatus(statusElem, `🔄 正在下载文件: ${fileName}...`, 'info');
    
        // 提取文件路径信息
        const [owner, repo] = state.githubConfig.repo.split('/');
    
        // 确定是路径还是URL
        let filePath;
        if (pathOrUrl.startsWith('http')) {
          // 这是一个URL，尝试从中提取路径
          const urlParts = pathOrUrl.split('/');
          filePath = pathOrUrl;
        } else {
          // 这是一个路径
          filePath = pathOrUrl;
        }
    
        // 使用GitHub API获取文件内容
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    
        const headers = {
          'Authorization': `token ${state.githubConfig.token}`,
          'Accept': 'application/vnd.github.v3+json'
        };
    
        const fileResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: headers
        });
    
        if (!fileResponse.ok) {
          const errorData = await fileResponse.json();
          updateSyncStatus(statusElem, `❌ 下载文件失败: ${errorData.message || '未知错误'}`, 'error');
          return false;
        }
    
        const fileData = await fileResponse.json();
    
        // GitHub API返回的内容是Base64编码的
        // 解码Base64内容，处理换行符问题
        let base64Content = fileData.content.replace(/\n/g, '');
    
        // 解码Base64内容
        const decodedContent = decodeURIComponent(
          Array.prototype.map.call(
            atob(base64Content),
            c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
          ).join('')
        );
    
        // 导入数据
        updateSyncStatus(statusElem, '🔄 正在导入数据...', 'info');
        const importResult = importMemos(decodedContent, true); // 使用静默模式
    
        if (importResult) {
          // 更新最后同步时间
          saveGitHubConfig({
            lastSync: new Date().toISOString()
          });
          updateSyncStatus(statusElem, `✅ 数据导入成功! 来自: ${fileName}`, 'success');
    
          // 刷新Memo列表
          setTimeout(() => {
            if (state.currentView === 'github-settings') {
              renderMemoList();
            }
          }, 2000);
    
          return true;
        } else {
          updateSyncStatus(statusElem, '❌ 数据导入失败', 'error');
          return false;
        }
      } catch (error) {
        console.error('文件下载和导入失败:', error);
        updateSyncStatus(statusElem, `❌ 导入出错: ${error.message || '未知错误'}`, 'error');
        return false;
      }
    }
    
    // 更新同步状态显示
    function updateSyncStatus(statusElem, message, type = 'info') {
      if (!statusElem) return;
    
      statusElem.textContent = message;
      statusElem.style.display = 'block';
    
      // 根据类型设置样式
      switch (type) {
        case 'error':
          statusElem.style.background = 'rgba(255, 71, 87, 0.2)';
          statusElem.style.color = '#ff4757';
          statusElem.style.border = '1px solid rgba(255, 71, 87, 0.3)';
          break;
        case 'success':
          statusElem.style.background = 'rgba(46, 213, 115, 0.2)';
          statusElem.style.color = '#2ed573';
          statusElem.style.border = '1px solid rgba(46, 213, 115, 0.3)';
          break;
        case 'info':
        default:
          statusElem.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))';
          statusElem.style.color = 'var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7))';
          statusElem.style.border = '1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';
      }
    }
    
    // 文件选择器 - 导入功能
    function createFileSelector() {
      // 移除已存在的选择器
      const existingSelector = MemoDoc.getElementById('memoFileSelector');
      if (existingSelector) {
        existingSelector.remove();
      }
    
      // 创建新的文件选择器
      const fileSelector = MemoDoc.createElement('input');
      fileSelector.type = 'file';
      fileSelector.id = 'memoFileSelector';
      fileSelector.accept = '.json';
      fileSelector.style.display = 'none';
    
      fileSelector.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          importMemos(content);
        };
        reader.readAsText(file);
      });
    
      MemoDoc.body.appendChild(fileSelector);
      return fileSelector;
    }
    
    // 添加复制Memo内容的函数
    function copyMemoContent(memoId) {
      // 确定要使用的聊天上下文 - 优先使用手动选择的上下文
      const context = state.selectedChatContext || getCurrentChatContext();
      const memos = loadMemosFromStorage(context);
      const memo = memos.find(m => m.id === memoId);
    
      if (!memo) {
        if (typeof toastr !== 'undefined') {
          toastr.error('找不到要复制的Memo！');
        }
        return;
      }
    
      // 获取要复制的内容（只复制笔记内容）
      const contentToCopy = memo.content || '';
    
      // 使用Clipboard API复制内容
      try {
        navigator.clipboard.writeText(contentToCopy).then(() => {
          if (typeof toastr !== 'undefined') {
            toastr.success('笔记内容已复制到剪贴板！');
          }
        }, (err) => {
          console.error('复制失败:', err);
          fallbackCopyTextToClipboard(contentToCopy);
        });
      } catch (err) {
        console.error('Clipboard API不可用，使用备用方法:', err);
        fallbackCopyTextToClipboard(contentToCopy);
      }
    }
    
    // 添加备用复制方法（用于不支持Clipboard API的浏览器）
    function fallbackCopyTextToClipboard(text) {
      const textArea = MemoDoc.createElement('textarea');
      textArea.value = text;
    
      // 设置样式使其不可见
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
    
      MemoDoc.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
    
      try {
        const successful = MemoDoc.execCommand('copy');
        if (successful) {
          if (typeof toastr !== 'undefined') {
            toastr.success('笔记内容已复制到剪贴板！');
          }
        } else {
          if (typeof toastr !== 'undefined') {
            toastr.error('复制失败，请手动复制！');
          }
        }
      } catch (err) {
        console.error('fallbackCopy失败:', err);
        if (typeof toastr !== 'undefined') {
          toastr.error('复制失败，请手动复制！');
        }
      }
    
      MemoDoc.body.removeChild(textArea);
    }
    
    // 添加确保Font Awesome加载的函数
    function ensureFontAwesomeLoaded() {
      // 检查是否已加载Font Awesome
      const fontAwesomeLoaded = Array.from(MemoDoc.querySelectorAll('link')).some(link =>
        link.href && (link.href.includes('font-awesome') || link.href.includes('fontawesome'))
      );
    
      // 如果没有加载，则添加Font Awesome CDN
      if (!fontAwesomeLoaded) {
        const fontAwesomeLink = MemoDoc.createElement('link');
        fontAwesomeLink.rel = 'stylesheet';
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        fontAwesomeLink.integrity = 'sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==';
        fontAwesomeLink.crossOrigin = 'anonymous';
        fontAwesomeLink.referrerPolicy = 'no-referrer';
        MemoDoc.head.appendChild(fontAwesomeLink);
      }
    }
    
    // 删除GitHub文件
    async function deleteGitHubFile(path, sha, statusElem) {
      try {
        if (!state.githubConfig.repo || !state.githubConfig.token) {
          updateSyncStatus(statusElem, '❌ 缺少GitHub仓库信息或令牌', 'error');
          return false;
        }
    
        updateSyncStatus(statusElem, '🔄 正在删除文件...', 'info');
    
        // GitHub API请求
        const [owner, repo] = state.githubConfig.repo.split('/');
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    
        // 准备请求头
        const headers = {
          'Authorization': `token ${state.githubConfig.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        };
    
        // 删除文件需要提供SHA值
        if (!sha) {
          updateSyncStatus(statusElem, '❌ 删除失败: 缺少文件SHA值', 'error');
          return false;
        }
    
        // 生成时间戳用于提交信息
        const timestamp = new Date().toISOString().slice(0, 16).replace(/[:\-]/g, '');
    
        // 发送删除请求
        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers: headers,
          body: JSON.stringify({
            message: `Delete memo file: ${timestamp}`,
            sha: sha,
            branch: state.githubConfig.branch
          })
        });
    
        if (response.ok) {
          updateSyncStatus(statusElem, '✅ 文件已成功删除', 'success');
    
          // 2秒后刷新文件列表
          setTimeout(() => {
            downloadFromGitHub(statusElem);
          }, 2000);
    
          return true;
        } else {
          const result = await response.json();
          updateSyncStatus(statusElem, `❌ 删除失败: ${result.message || '未知错误'}`, 'error');
          return false;
        }
      } catch (error) {
        console.error('删除GitHub文件失败:', error);
        updateSyncStatus(statusElem, `❌ 删除出错: ${error.message || '未知错误'}`, 'error');
        return false;
      }
    }
    
    // 清除所有本地Memo数据
    function clearAllLocalMemos() {
      try {
        // 确认是否要清除所有Memo
        if (!confirm('确定要清除所有本地保存的Memo吗？此操作不可恢复！')) {
          return false;
        }
    
        // 获取所有以memo_开头的localStorage键
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(LOCAL_STORAGE_KEY_PREFIX) && key !== GITHUB_CONFIG_KEY) {
            keysToRemove.push(key);
          }
        }
    
        // 删除所有找到的键
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
    
        // 显示成功消息
        if (typeof toastr !== 'undefined') {
          toastr.success(`已清除 ${keysToRemove.length} 个聊天的Memo数据！`);
        }
    
        // 刷新Memo列表
        renderMemoList();
        return true;
      } catch (error) {
        console.error('清除Memo数据失败:', error);
        if (typeof toastr !== 'undefined') {
          toastr.error('清除失败: ' + error.message);
        }
        return false;
      }
    }
    
    function selectAllBetween() {
      if (selectionState.selectedParagraphs.length < 2) {
        return; // 需要至少选择2个段落
      }
    
      // 获取所有段落元素
      const allParagraphs = Array.from(MemoDoc.querySelectorAll('.mes_text p, .message_text p, .mes_text div:not(.memo-annotation-btn):not([class*="btn"]):not([class*="button"]), .message_text div:not(.memo-annotation-btn):not([class*="btn"]):not([class*="button"])'))
        .filter(p => {
          const textContent = getPureTextContent(p);
          return textContent && textContent.length >= 1;
        });
    
      // 按DOM顺序排序已选中的段落
      const sortedSelected = sortParagraphsByDOMOrder([...selectionState.selectedParagraphs]);
      
      // 找到第一个和最后一个选中段落在所有段落中的索引
      const firstSelectedIndex = allParagraphs.findIndex(p => p === sortedSelected[0].element);
      const lastSelectedIndex = allParagraphs.findIndex(p => p === sortedSelected[sortedSelected.length - 1].element);
    
      if (firstSelectedIndex === -1 || lastSelectedIndex === -1) {
        console.warn('Memo: 无法找到选中段落的位置');
        return;
      }
    
      // 选中第一个和最后一个之间的所有段落
      for (let i = firstSelectedIndex; i <= lastSelectedIndex; i++) {
        const paragraph = allParagraphs[i];
        
        // 检查是否已经选中
        const isAlreadySelected = selectionState.selectedParagraphs.some(p => p.element === paragraph);
        
        if (!isAlreadySelected) {
          const paragraphText = getPureTextContent(paragraph);
          if (paragraphText) {
            const messageId = getMessageId(paragraph);
            
            selectionState.selectedParagraphs.push({
              element: paragraph,
              text: paragraphText,
              messageId: messageId,
              timestamp: Date.now()
            });
            
            paragraph.classList.add('memo-paragraph-selected');
          }
        }
      }
    
      // 更新所有按钮状态
      updateAllAnnotationButtons();
      updateCompleteButton();
      
      // 显示成功提示
      if (typeof toastr !== 'undefined') {
        const newSelections = (lastSelectedIndex - firstSelectedIndex + 1) - sortedSelected.length;
        toastr.success(`已选中中间的 ${newSelections} 个段落！`);
      }
    }
    
    // 更新全选按钮状态
    function updateSelectAllButton() {
      const selectAllBtn = selectionState.controlPanel?.querySelector('#memoSelectAllBetween');
      
      if (!selectAllBtn || !selectionState.isMultiSelectMode) {
        return;
      }
    
      // 检查是否需要显示全选按钮
      const shouldShowButton = checkShouldShowSelectAllButton();
      
      if (shouldShowButton) {
        selectAllBtn.style.display = 'block';
        
        // 检查是否已经全选了中间段落
        const isAllSelected = checkAllBetweenSelected();
        if (isAllSelected) {
          selectAllBtn.textContent = '已全选';
          selectAllBtn.disabled = true;
          selectAllBtn.classList.add('secondary');
        } else {
          selectAllBtn.textContent = '全选中间';
          selectAllBtn.disabled = false;
          selectAllBtn.classList.remove('secondary');
        }
      } else {
        selectAllBtn.style.display = 'none';
      }
    }
    
    // 检查是否应该显示全选按钮
    function checkShouldShowSelectAllButton() {
      if (selectionState.selectedParagraphs.length < 2) {
        return false; // 需要至少选择2个段落
      }
    
      // 获取所有段落元素
      const allParagraphs = Array.from(MemoDoc.querySelectorAll('.mes_text p, .message_text p, .mes_text div:not(.memo-annotation-btn):not([class*="btn"]):not([class*="button"]), .message_text div:not(.memo-annotation-btn):not([class*="btn"]):not([class*="button"])'))
        .filter(p => {
          const textContent = getPureTextContent(p);
          return textContent && textContent.length >= 1;
        });
    
      // 按DOM顺序排序已选中的段落
      const sortedSelected = sortParagraphsByDOMOrder([...selectionState.selectedParagraphs]);
      
      // 找到第一个和最后一个选中段落在所有段落中的索引
      const firstSelectedIndex = allParagraphs.findIndex(p => p === sortedSelected[0].element);
      const lastSelectedIndex = allParagraphs.findIndex(p => p === sortedSelected[sortedSelected.length - 1].element);
    
      if (firstSelectedIndex === -1 || lastSelectedIndex === -1) {
        return false;
      }
    
      // 检查中间是否有未选中的段落
      const totalBetween = lastSelectedIndex - firstSelectedIndex + 1;
      return totalBetween > selectionState.selectedParagraphs.length;
    }
    
    // 检查是否已经全选了中间段落
    function checkAllBetweenSelected() {
      if (selectionState.selectedParagraphs.length < 2) {
        return false;
      }
    
      // 获取所有段落元素
      const allParagraphs = Array.from(MemoDoc.querySelectorAll('.mes_text p, .message_text p, .mes_text div:not(.memo-annotation-btn):not([class*="btn"]):not([class*="button"]), .message_text div:not(.memo-annotation-btn):not([class*="btn"]):not([class*="button"])'))
        .filter(p => {
          const textContent = getPureTextContent(p);
          return textContent && textContent.length >= 1;
        });
    
      // 按DOM顺序排序已选中的段落
      const sortedSelected = sortParagraphsByDOMOrder([...selectionState.selectedParagraphs]);
      
      // 找到第一个和最后一个选中段落在所有段落中的索引
      const firstSelectedIndex = allParagraphs.findIndex(p => p === sortedSelected[0].element);
      const lastSelectedIndex = allParagraphs.findIndex(p => p === sortedSelected[sortedSelected.length - 1].element);
    
      if (firstSelectedIndex === -1 || lastSelectedIndex === -1) {
        return false;
      }
    
      // 检查第一个和最后一个之间的所有段落是否都已选中
      for (let i = firstSelectedIndex; i <= lastSelectedIndex; i++) {
        const paragraph = allParagraphs[i];
        const isSelected = selectionState.selectedParagraphs.some(p => p.element === paragraph);
        if (!isSelected) {
          return false;
        }
      }
    
      return true;
    }
    
    // 字体管理相关函数 - 专门处理网络字体
    function loadCustomFonts() {
      try {
        const fontsStr = localStorage.getItem(FONT_STORAGE_KEY);
        if (fontsStr) {
          const fonts = JSON.parse(fontsStr);
          // 只保留网络字体（有url属性的）
          const networkFonts = fonts.filter(font => font.url && !font.data);
          state.fontConfig.customFonts = networkFonts;
          return networkFonts;
        }
        return [];
      } catch (error) {
        console.error('加载网络字体失败:', error);
        return [];
      }
    }
    
    function saveCustomFonts(fonts) {
      try {
        // 只保存网络字体
        const networkFonts = fonts.filter(font => font.url && !font.data);
        localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(networkFonts));
        state.fontConfig.customFonts = networkFonts;
        return true;
      } catch (error) {
        console.error('保存网络字体失败:', error);
        return false;
      }
    }
    
    function loadFontPreference() {
      try {
        const fontStr = localStorage.getItem(FONT_PREFERENCE_KEY);
        if (fontStr) {
          state.fontConfig.currentFont = fontStr;
          return fontStr;
        }
        return 'QiushuiShotai'; // 默认字体
      } catch (error) {
        console.error('加载字体偏好失败:', error);
        return 'QiushuiShotai';
      }
    }
    
    function saveFontPreference(fontName) {
      try {
        localStorage.setItem(FONT_PREFERENCE_KEY, fontName);
        state.fontConfig.currentFont = fontName;
        return true;
      } catch (error) {
        console.error('保存字体偏好失败:', error);
        return false;
      }
    }
    
    // 加载所有保存的网络字体
    async function loadAllCustomFonts() {
      const fonts = loadCustomFonts();
      const loadPromises = fonts.map(font => {
        if (font.url && !state.fontConfig.loadedFonts.has(font.name)) {
          return loadFontFromCssUrl(font.url, font.name).catch(error => {
            console.error(`跳过加载网络字体 "${font.name}":`, error);
          });
        }
      });
      
      await Promise.all(loadPromises);
    }
    
    // 添加网络字体到存储
    function addNetworkFont(fontName, fontUrl) {
      try {
        const fonts = loadCustomFonts();
        
        // 检查是否已存在
        const existingIndex = fonts.findIndex(f => f.name === fontName || f.url === fontUrl);
        
        const fontData = {
          id: Date.now(),
          name: fontName,
          url: fontUrl,
          type: 'network',
          addedTime: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
          fonts[existingIndex] = fontData;
        } else {
          fonts.push(fontData);
        }
        
        saveCustomFonts(fonts);
        return true;
      } catch (error) {
        console.error('添加网络字体失败:', error);
        return false;
      }
    }
    
    // 删除网络字体
    function deleteNetworkFont(fontName) {
      try {
        const fonts = loadCustomFonts();
        const filteredFonts = fonts.filter(f => f.name !== fontName);
        saveCustomFonts(filteredFonts);
        
        // 如果删除的是当前使用的字体，重置为默认字体
        if (state.fontConfig.currentFont === fontName) {
          saveFontPreference('QiushuiShotai');
        }
        
        // 从已加载字体中移除
        state.fontConfig.loadedFonts.delete(fontName);
        
        return true;
      } catch (error) {
        console.error('删除网络字体失败:', error);
        return false;
      }
    }
    
    // CSS字体URL加载相关函数
    async function loadFontFromUrl(fontUrl, fontSelector) {
      try {
        toastr.info('正在加载网络字体...');
        
        // 解析字体URL
        const cssUrl = parseFontUrl(fontUrl);
        if (!cssUrl) {
          toastr.error('无法解析字体URL，请检查格式是否正确');
          return;
        }
        
        // 获取CSS内容并提取字体名称
        const fontName = await loadAndExtractFontName(cssUrl);
        if (!fontName) {
          toastr.error('无法从CSS中提取字体名称');
          return;
        }
        
        // 检查字体是否已经加载
        if (state.fontConfig.loadedFonts.has(fontName)) {
          toastr.info(`字体 "${fontName}" 已经加载过了`);
          updateFontSelector(fontName, fontSelector);
          return;
        }
        
        // 加载字体
        await loadFontFromCssUrl(cssUrl, fontName);
        
        // 保存到localStorage
        addNetworkFont(fontName, cssUrl);
        
        // 更新字体选择器
        updateFontSelector(fontName, fontSelector);
        
        toastr.success(`网络字体 "${fontName}" 加载成功！`);
        
      } catch (error) {
        console.error('加载网络字体失败:', error);
        toastr.error(`加载字体失败：${error.message}`);
      }
    }
    
    // 解析字体URL，支持@import和直接CSS链接
    function parseFontUrl(input) {
      const trimmedInput = input.trim();
      
      try {
        // 处理@import格式：@import url("https://fontsapi.zeoseven.com/670/main/result.css");
        if (trimmedInput.startsWith('@import')) {
          const urlMatch = trimmedInput.match(/@import\s+url\s*\(\s*["']?([^"')]+)["']?\s*\)/);
          if (urlMatch) {
            return urlMatch[1];
          }
        }
        
        // 处理直接CSS链接
        if (trimmedInput.startsWith('http')) {
          return trimmedInput;
        }
        
        return null;
      } catch (error) {
        console.error('解析字体URL失败:', error);
        return null;
      }
    }
    
    // 加载CSS并提取字体名称
    async function loadAndExtractFontName(cssUrl) {
      try {
        // 获取CSS内容
        const response = await fetch(cssUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const cssContent = await response.text();
        
        // 从CSS内容中提取字体名称
        const fontName = extractFontNameFromCss(cssContent);
        
        return fontName;
      } catch (error) {
        console.error('获取CSS内容失败:', error);
        throw error;
      }
    }
    
    // 改进的字体名称提取，从CSS内容中提取真正的字体名称
    function extractFontNameFromCss(cssContent) {
      try {
        // 尝试匹配各种可能的font-family声明格式
        const patterns = [
          // 标准格式：font-family: "fontname";
          /font-family:\s*["']([^"']+)["']/g,
          // CSS变量格式：--font-family: "fontname";
          /--font-family:\s*["']([^"']+)["']/g,
          // 无引号格式：font-family: fontname;
          /font-family:\s*([^;,\s]+)/g,
          // @font-face格式：font-family: "fontname"
          /@font-face\s*\{[^}]*font-family:\s*["']([^"']+)["']/g
        ];
        
        const foundFonts = new Set();
        
        // 尝试所有模式
        for (const pattern of patterns) {
          let match;
          const regex = new RegExp(pattern.source, pattern.flags);
          while ((match = regex.exec(cssContent)) !== null) {
            const fontName = match[1].trim();
            // 排除通用字体名称
            if (fontName && !isGenericFontName(fontName)) {
              foundFonts.add(fontName);
            }
          }
        }
        
        if (foundFonts.size > 0) {
          // 返回第一个找到的非通用字体名称
          return Array.from(foundFonts)[0];
        }
        
        // 如果都没找到，生成一个唯一名称
        const timestamp = Date.now().toString().slice(-6);
        return `WebFont_${timestamp}`;
        
      } catch (error) {
        console.error('从CSS提取字体名称失败:', error);
        const timestamp = Date.now().toString().slice(-6);
        return `WebFont_${timestamp}`;
      }
    }
    
    // 检查是否是通用字体名称
    function isGenericFontName(fontName) {
      const genericFonts = [
        'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy',
        'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace',
        'Arial', 'Helvetica', 'Times', 'Courier', 'Georgia', 'Verdana'
      ];
      
      return genericFonts.some(generic => 
        fontName.toLowerCase().includes(generic.toLowerCase())
      );
    }
    
    // 使用CSS link标签加载字体
    async function loadFontFromCssUrl(cssUrl, fontName) {
      return new Promise((resolve, reject) => {
        // 检查是否已经有相同的link标签
        const existingLink = MemoDoc.querySelector(`link[href="${cssUrl}"]`);
        if (existingLink) {
          // 已经加载过了，直接标记为已加载
          state.fontConfig.loadedFonts.add(fontName);
          resolve();
          return;
        }
        
        // 创建link标签加载CSS
        const link = MemoDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        link.crossOrigin = 'anonymous'; // 支持跨域
        
        link.onload = () => {
          // CSS加载成功
          console.log(`CSS字体文件加载成功: ${cssUrl}`);
          state.fontConfig.loadedFonts.add(fontName);
          resolve();
        };
        
        link.onerror = () => {
          console.error(`加载CSS字体文件失败: ${cssUrl}`);
          reject(new Error(`无法加载CSS文件：${cssUrl}`));
        };
        
        // 添加到页面
        MemoDoc.head.appendChild(link);
        
        // 设置超时，防止无限等待
        setTimeout(() => {
          reject(new Error('字体加载超时'));
        }, 10000);
      });
    }
    
    // 更新字体选择器（用于网络字体）
    function updateFontSelector(fontName, fontSelector) {
      // 检查选项是否已存在
      const existingOption = Array.from(fontSelector.options).find(option => option.value === fontName);
      
      if (!existingOption) {
        // 添加新的选项到字体选择器
        const option = MemoDoc.createElement('option');
        option.value = fontName;
        option.textContent = `${fontName} - 网络字体`;
        fontSelector.appendChild(option);
      }
      
      // 选中新字体
      fontSelector.value = fontName;
      
      // 保存字体偏好
      saveFontPreference(fontName);
      
      // 如果在年度总结界面，还需要更新报告字体选择器
      const reportFontSelector = MemoDoc.getElementById('reportFontSelector');
      if (reportFontSelector && reportFontSelector !== fontSelector) {
        // 检查报告字体选择器中是否已存在该选项
        const reportExistingOption = Array.from(reportFontSelector.options).find(option => option.value === fontName);
        
        if (!reportExistingOption) {
          const reportOption = MemoDoc.createElement('option');
          reportOption.value = fontName;
          reportOption.textContent = `${fontName} - 网络字体`;
          reportFontSelector.appendChild(reportOption);
        }
        
        // 如果当前是在年度总结界面触发的字体加载，也选中报告字体选择器中的新字体
        if (state.currentView === 'yearly-report-result') {
          reportFontSelector.value = fontName;
        }
      }
      
      console.log(`字体已更新为: ${fontName}`);
    }
    
    // 为选择器添加焦点样式
    function addSelectFocusStyles(selector) {
      const element = MemoDoc.querySelector(selector);
      if (element) {
        element.addEventListener('focus', function () {
          this.style.borderColor = 'var(--SmartThemeQuoteColor, #4a9eff)';
          this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08))';
          this.style.boxShadow = '0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2))';
        });
        element.addEventListener('blur', function () {
          this.style.borderColor = 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';
          this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))';
          this.style.boxShadow = 'none';
        });
      }
    }
    
    // 重新生成图片
    function regenerateImageWithNewSettings(memo, style, font, previewImage, loadingIndicator, styleSelector, fontSelector) {
      // 显示加载指示器
      loadingIndicator.style.display = 'block';
      styleSelector.disabled = true;
      fontSelector.disabled = true;
    
      // 生成新图片
      generateMemoImage(memo, style, font).then(newImageDataUrl => {
        previewImage.src = newImageDataUrl;
    
        // 保存偏好
        saveStylePreference(style);
        saveFontPreference(font);
    
        // 隐藏加载指示器
        loadingIndicator.style.display = 'none';
        styleSelector.disabled = false;
        fontSelector.disabled = false;
    
        toastr.success('图片生成成功！');
      }).catch(error => {
        console.error('Memo: 生成图片失败:', error);
    
        // 隐藏加载指示器
        loadingIndicator.style.display = 'none';
        styleSelector.disabled = false;
        fontSelector.disabled = false;
    
        toastr.error('生成图片失败，请重试');
      });
    }
    
    // 加载自定义颜色配置
    function loadCustomColorConfig() {
      try {
        const configStr = localStorage.getItem(CUSTOM_COLOR_CONFIG_KEY);
        if (configStr) {
          const config = JSON.parse(configStr);
          // 合并到state中，保持默认值
          state.customColorConfig = {
            ...state.customColorConfig,
            ...config
          };
          return config;
        }
        return state.customColorConfig; // 返回默认配置
      } catch (error) {
        console.error('加载自定义颜色配置失败:', error);
        return state.customColorConfig;
      }
    }
    
    // 保存自定义颜色配置
    function saveCustomColorConfig(config) {
      try {
        // 更新state
        state.customColorConfig = {
          ...state.customColorConfig,
          ...config
        };
        localStorage.setItem(CUSTOM_COLOR_CONFIG_KEY, JSON.stringify(state.customColorConfig));
        return true;
      } catch (error) {
        console.error('保存自定义颜色配置失败:', error);
        return false;
      }
    }

    // 加载保存的自定义配色方案
    function loadSavedColorSchemes() {
      try {
        const schemesStr = localStorage.getItem(SAVED_COLOR_SCHEMES_KEY);
        if (schemesStr) {
          state.savedColorSchemes = JSON.parse(schemesStr);
          return state.savedColorSchemes;
        }
        return {};
      } catch (error) {
        console.error('加载保存的配色方案失败:', error);
        state.savedColorSchemes = {};
        return {};
      }
    }

    // 保存自定义配色方案
    function saveColorScheme(name, config) {
      try {
        if (!name || typeof name !== 'string' || name.trim() === '') {
          return false;
        }
        
        // 加载现有的方案
        loadSavedColorSchemes();
        
        // 添加或更新方案
        state.savedColorSchemes[name] = {
          ...config,
          createdAt: new Date().toISOString()
        };
        
        // 保存到localStorage
        localStorage.setItem(SAVED_COLOR_SCHEMES_KEY, JSON.stringify(state.savedColorSchemes));
        return true;
      } catch (error) {
        console.error('保存配色方案失败:', error);
        return false;
      }
    }

    // 删除保存的配色方案
    function deleteColorScheme(name) {
      try {
        // 加载现有的方案
        loadSavedColorSchemes();
        
        // 检查方案是否存在
        if (!state.savedColorSchemes[name]) {
          return false;
        }
        
        // 删除方案
        delete state.savedColorSchemes[name];
        
        // 保存到localStorage
        localStorage.setItem(SAVED_COLOR_SCHEMES_KEY, JSON.stringify(state.savedColorSchemes));
        return true;
      } catch (error) {
        console.error('删除配色方案失败:', error);
        return false;
      }
    }

    /**
     * 删除自定义卡片样式（配色方案）
     * @param {string} styleValue 样式值（如 saved:xxx）
     * @returns {boolean} 是否删除成功
     */
    function deleteCustomStyle(styleValue) {
      if (!styleValue.startsWith('saved:')) return false;
      const schemeName = styleValue.replace('saved:', '');
      loadSavedColorSchemes();
      if (!state.savedColorSchemes[schemeName]) return false;
      delete state.savedColorSchemes[schemeName];
      localStorage.setItem(SAVED_COLOR_SCHEMES_KEY, JSON.stringify(state.savedColorSchemes));
      return true;
    }

    // =========================== LLM 相关功能 ===========================
    
    // 加载LLM配置
    function loadLLMConfig() {
        try {
          const configStr = localStorage.getItem(LLM_CONFIG_KEY);
          if (configStr) {
            const config = JSON.parse(configStr);
            state.llmConfig = { ...state.llmConfig, ...config };
          }
      } catch (error) {
          console.error('加载LLM配置失败:', error);
        }
      }
      
      // 保存LLM配置
      function saveLLMConfig(config) {
        try {
          // 更新状态
          state.llmConfig = { ...state.llmConfig, ...config };
          // 保存到localStorage
          localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(state.llmConfig));
          return true;
        } catch (error) {
          console.error('保存LLM配置失败:', error);
          return false;
        }
      }
      
      // 测试LLM连接
      async function testLLMConnection(apiUrl, apiKey) {
        try {
          // 验证输入参数
          if (!apiUrl || !apiKey) {
            throw new Error('API URL和API Key都是必填项');
          }
    
          // 检查URL格式
          try {
            new URL(apiUrl);
          } catch (e) {
            throw new Error('API URL格式不正确，请检查URL是否完整（包含 http:// 或 https://）');
          }
    
          // 首先尝试获取模型列表来测试连接
          try {
            const modelsUrl = apiUrl.replace(/\/chat\/completions$/, '/models');
            const modelsResponse = await fetch(modelsUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            });
    
            if (modelsResponse.ok) {
              const modelsData = await modelsResponse.json();
              return { success: true, data: modelsData, method: 'models' };
            }
          } catch (e) {
            // 如果模型列表API失败，继续尝试聊天完成API
            console.log('模型列表API测试失败，尝试聊天完成API');
          }
    
          // 尝试聊天完成API，使用更通用的测试消息
          const testPayloads = [
            // 标准OpenAI格式
            {
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 5
            },
            // 如果有已配置的模型，使用已配置的模型
            ...(state.llmConfig.model ? [{
              model: state.llmConfig.model,
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 5
            }] : []),
            // 尝试不指定模型（某些API可能有默认模型）
            {
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 5
            }
          ];
    
          let lastError = null;
          
          for (const payload of testPayloads) {
            try {
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
              });
    
              if (response.ok) {
                const data = await response.json();
                return { success: true, data, method: 'chat', payload };
              } else {
                // 记录错误但继续尝试下一个payload
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                
                try {
                  const errorData = await response.json();
                  if (errorData.error && errorData.error.message) {
                    errorMessage += ` - ${errorData.error.message}`;
                  } else if (errorData.message) {
                    errorMessage += ` - ${errorData.message}`;
                  }
                } catch (e) {
                  // 无法解析错误响应
                }
                
                lastError = new Error(errorMessage);
                
                // 如果是401/403错误，直接返回（认证问题）
                if (response.status === 401 || response.status === 403) {
                  throw lastError;
                }
              }
            } catch (e) {
              lastError = e;
              // 如果是网络错误，直接返回
              if (e.name === 'TypeError' && e.message.includes('fetch')) {
                throw e;
              }
            }
          }
    
          // 如果所有payload都失败了，抛出最后一个错误
          throw lastError || new Error('所有测试方法都失败了');
    
        } catch (error) {
          console.error('LLM连接测试失败:', error);
          
          // 网络错误的特殊处理
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return { 
              success: false, 
              error: '网络连接失败，请检查网络连接或API服务是否可用' 
            };
          }
          
          // 针对常见错误码提供解决建议
          let errorMessage = error.message;
          if (errorMessage.includes('401')) {
            errorMessage += '\n建议：请检查API Key是否正确';
          } else if (errorMessage.includes('403')) {
            errorMessage += '\n建议：API Key可能没有访问权限';
          } else if (errorMessage.includes('404')) {
            errorMessage += '\n建议：请检查API URL是否正确';
          } else if (errorMessage.includes('402')) {
            errorMessage += '\n建议：API调用频率过高，请稍后再试';
          } else if (errorMessage.includes('500')) {
            errorMessage += '\n建议：服务器内部错误，请稍后再试';
          } else if (errorMessage.includes('503')) {
            errorMessage += '\n建议：服务暂时不可用，请检查API服务状态或稍后再试';
          }
          
          return { success: false, error: errorMessage };
        }
      }
      
      // 获取可用模型列表
      async function fetchAvailableModels(apiUrl, apiKey) {
        try {
          // 尝试多种可能的模型列表API端点
          const possibleEndpoints = [
            apiUrl.replace(/\/chat\/completions$/, '/models'),
            apiUrl.replace(/\/chat\/completions$/, '/v1/models'),
            apiUrl.replace(/\/v1\/chat\/completions$/, '/v1/models'),
            apiUrl.replace(/\/v1\/chat\/completions$/, '/models')
          ];
    
          // 去重
          const uniqueEndpoints = [...new Set(possibleEndpoints)];
    
          for (const endpoint of uniqueEndpoints) {
            try {
              const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json'
                }
              });
    
              if (response.ok) {
                const data = await response.json();
                
                // 尝试解析不同格式的响应
                let models = [];
                
                if (data.data && Array.isArray(data.data)) {
                  // OpenAI格式
                  models = data.data.map(model => model.id || model.name).filter(Boolean);
                } else if (data.models && Array.isArray(data.models)) {
                  // 某些API的models字段格式
                  models = data.models.map(model => model.id || model.name || model).filter(Boolean);
                } else if (Array.isArray(data)) {
                  // 直接是数组格式
                  models = data.map(model => model.id || model.name || model).filter(Boolean);
                } else if (data.object === 'list' && data.data) {
                  // OpenAI标准格式
                  models = data.data.map(model => model.id || model.name).filter(Boolean);
                }
    
                if (models.length > 0) {
                  return models;
                }
              }
            } catch (e) {
              console.log(`尝试端点 ${endpoint} 失败:`, e.message);
              continue;
            }
          }
    
          // 如果所有端点都失败，返回常见模型列表
          console.log('所有模型列表API都失败，返回常见模型列表');
          return [
            'gpt-3.5-turbo',
            'gpt-4',
            'gpt-4-turbo',
            'gpt-4o',
            'claude-3-sonnet',
            'claude-3-haiku',
            'claude-3-opus',
            'gemini-pro',
            'llama-2-70b',
            'mixtral-8x7b'
          ];
      } catch (error) {
          console.error('获取模型列表失败:', error);
          // 返回一些常见模型作为备选
          return [
            'gpt-3.5-turbo',
            'gpt-4',
            'gpt-4-turbo',
            'gpt-4o',
            'claude-3-sonnet',
            'claude-3-haiku',
            'claude-3-opus',
            'gemini-pro',
            'llama-2-70b',
            'mixtral-8x7b'
          ];
        }
      }
      
      // 调用LLM生成年度总结
      async function generateYearlyReport(selectedMemos, statusCallback) {
        try {
          if (!state.llmConfig.apiUrl || !state.llmConfig.apiKey) {
            throw new Error('请先配置LLM API设置');
          }
      
          if (!state.llmConfig.model) {
            throw new Error('请先选择LLM模型');
          }
      
          if (!selectedMemos || selectedMemos.length === 0) {
            throw new Error('没有选择任何memo数据');
          }
      
          statusCallback('正在准备数据...');
      
          // 构建提示词
          const prompt = ` <memo>${JSON.stringify(selectedMemos, null, 2)}</memo>
          <memo>中是用户在使用Sillytavern时记录的一些Memo，其中的每个字段的含义分别是
      - title：用户给笔记设置的标题
      - content：用户记下的笔记内容
      - originalText：用户摘抄下的原始段落
      - createAt/updateAt：笔记创建/最后编辑的时间
      另外每一个memo的命名分别为"memo_用户对话的角色名-用户给这篇对话起的名字".
      请基于Memo中记录的内容，根据以下参考资料，生成一篇对用户Memo记录的行为报告
      参考资料：
      你是否知道网易云/美团外卖每年都会根据用户在他们的app上的使用行为，为用户生成一篇年度总结？请模仿这种年度总结，生成一篇分析用户的Memo记录的行为报告。
      需要富有冷幽默，用一针见血的言辞对用户的Memo记录进行犀利的讽刺或吐槽。
      吐槽的内容包括但不限于用户记录的时间/用户记录的内容/用户摘录的内容/用户对角色的记录次数等等。吐槽过程中可以适当使用emoji，增添幽默感。
      完成吐槽后，你还需要发挥创意，生成用户的MBTI推测/喜好分析等用户画像分析（即给用户贴标签）、对用户未来使用Memo的趣味推测、对记录的Memo中提及的角色的命运/未来的展望等等扩展内容，不必拘束于以上提到的形式，请尽情发挥创意，增加报告的趣味性和创新性！
      注意，不必使用css或html生成网页美化格式，但可使用Markdown格式生成简单的表格对用户喜好/习惯/关键词出现次数等进行分析，让数据更直观。必须使用中文输出。`;
      
          statusCallback('Memo使用报告生成中...');
      
          const response = await fetch(state.llmConfig.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${state.llmConfig.apiKey}`
            },
            body: JSON.stringify({
              model: state.llmConfig.model,
              messages: [
                { role: 'user', content: prompt }
              ],
              temperature: state.llmConfig.temperature,
              max_tokens: 2000
            })
          });
      
          if (!response.ok) {
            throw new Error(`LLM API调用失败: HTTP ${response.status}`);
          }
      
          const data = await response.json();
          
          if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content;
          } else {
            throw new Error('LLM返回数据格式异常');
          }
      } catch (error) {
          console.error('行为报告生成失败:', error);
          throw error;
        }
      }
      
      // 生成年度总结长图
      function generateYearlyReportImage(reportText, style = 'summer', customFont = 'QiushuiShotai') {
        return new Promise((resolve, reject) => {
          try {
            // 加载自定义颜色配置
            loadCustomColorConfig();
            
            // 使用现有的主题配置，并添加自定义主题
            const themes = {
              marshmallow: {
                name: '棉花糖 - 粉蓝',
                background: {
                  colors: ['#f8f9ff', '#f0f4ff', '#fff0f5', '#fff5f0']
                },
                colors: {
                  userInfo: '#666',
                  time: '#999',
                  title: '#2c3e50',
                  accent: '#4a9eff',
                  excerpt: '#34495e',
                  notes: '#555',
                  brand: '#999',
                  decorativeLine: '#4a9eff',
                  separatorLine: '#e0e0e0'
                }
              },
              drowninlove: {
                name: '泥沼中 - 青黑',
                background: {
                  colors: ['#000000', '#0a0a0a', '#050505', '#000000']
                },
                colors: {
                  userInfo: '#00cccc',
                  time: '#008888',
                  title: '#00ffff',
                  accent: '#00ffff',
                  excerpt: '#00eeee',
                  notes: '#00dddd',
                  brand: '#00aaaa',
                  decorativeLine: '#00ffff',
                  separatorLine: '#003333'
                }
              },
              summer: {
                name: '长夏 - 绿色',
                background: {
                  colors: ['#f0fff0', '#e8f8e8', '#d8f0d8', '#c8e8c8']
                },
                colors: {
                  userInfo: '#2d5a2d',
                  time: '#5a7a5a',
                  title: '#1e3a1e',
                  accent: '#28a745',
                  excerpt: '#2d5a2d',
                  notes: '#3d6a3d',
                  brand: '#5a7a5a',
                  decorativeLine: '#28a745',
                  separatorLine: '#b8d8b8'
                }
              },
              papper: {
                name: '如是说 - 信纸',
                background: {
                  colors: ['#f5f2e8', '#f8f5eb', '#f2efdf', '#f6f3e5']
                },
                colors: {
                  userInfo: '#5d4e37',
                  time: '#8b7d6b',
                  title: '#2c5aa0',
                  accent: '#2c5aa0',
                  excerpt: '#2c5aa0',
                  notes: '#4a4a4a',
                  brand: '#8b7d6b',
                  decorativeLine: '#2c5aa0',
                  separatorLine: '#d4c5a9'
                }
              },
              rose: {
                name: '朱砂痣 - 朱红',
                background: {
                  colors: ['#fdf5f5', '#f8e6e6', '#f0d0d0', '#e8c0c0']
                },
                colors: {
                  userInfo: '#8b4a4a',
                  time: '#a05656',
                  title: '#a64545',
                  accent: '#a64545',
                  excerpt: '#a64545',
                  notes: '#735555',
                  brand: '#a05656',
                  decorativeLine: '#a64545',
                  separatorLine: '#e8c5c5'
                }
              },
              ink: {
                name: '缓缓 - 淡墨',
                background: {
                  colors: ['#f8f8f8', '#f0f0f0', '#e8e8e8', '#f5f5f5']
                },
                colors: {
                  userInfo: '#2c3e50',
                  time: '#34495e',
                  title: '#1a237e',
                  accent: '#3949ab',
                  excerpt: '#283593',
                  notes: '#1a237e',
                  brand: '#5c6bc0',
                  decorativeLine: '#3949ab',
                  separatorLine: '#bdc3c7'
                }
              },
              custom: {
                name: '自定义配色',
                background: {
                  colors: [
                    state.customColorConfig.color1,
                    state.customColorConfig.color2,
                    state.customColorConfig.color1,
                    state.customColorConfig.color2
                  ]
                },
                colors: {
                  userInfo: state.customColorConfig.textColors.userInfo,
                  time: state.customColorConfig.textColors.time,
                  title: state.customColorConfig.textColors.title,
                  accent: state.customColorConfig.textColors.accent,
                  excerpt: state.customColorConfig.textColors.excerpt,
                  notes: state.customColorConfig.textColors.notes,
                  brand: state.customColorConfig.textColors.brand,
                  decorativeLine: state.customColorConfig.textColors.decorativeLine,
                  separatorLine: state.customColorConfig.textColors.separatorLine
                }
              }
            };
    
            const theme = themes[style] || themes.summer;
            const canvas = MemoDoc.createElement('canvas');
            const ctx = canvas.getContext('2d');
    
            // 设置画布尺寸
            const width = 800;
            const padding = 40;
            const contentWidth = width - padding * 2;
    
            // 先创建一个临时canvas来计算实际需要的高度
            const tempCanvas = MemoDoc.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = width;
            tempCanvas.height = 2000; // 给一个足够大的高度用于计算
            
            // 计算实际内容高度
            const actualHeight = calculateActualContentHeight(tempCtx, reportText, width, theme, customFont);
            
            // 使用计算出的实际高度，并增加适当的底部边距
            const height = actualHeight + 40; // 只增加40px的底部边距，而不是100px
    
            canvas.width = width;
            canvas.height = height;
    
            // 设置画布缩放以获得更清晰的文字
            const scale = 2;
            canvas.width = width * scale;
            canvas.height = height * scale;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            ctx.scale(scale, scale);
    
            // 绘制背景
            drawBackground(ctx, width, height, theme);
    
            // 绘制内容
            drawYearlyReportContent(ctx, reportText, width, height, theme, customFont).then(() => {
              resolve(canvas.toDataURL('image/png', 0.9));
            }).catch(reject);
    
          } catch (error) {
            reject(error);
          }
        });
      }
      
      // 解析markdown内容并转换为可渲染的结构
      function parseMarkdownForCanvas(text) {
        const lines = text.split('\n');
        const parsedContent = [];
        let currentTable = null;
        let inCodeBlock = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // 检查代码块
          if (line.trim().startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
          }
          
          if (inCodeBlock) {
            parsedContent.push({
              type: 'code',
              content: line,
              indent: 0
            });
            continue;
          }
          
          // 检查标题
          if (line.match(/^#{1,6}\s/)) {
            const level = line.match(/^#+/)[0].length;
            parsedContent.push({
              type: 'heading',
              content: line.replace(/^#+\s*/, ''),
              level: level
            });
            continue;
          }
          
          // 检查表格
          if (line.includes('|') && line.trim() !== '') {
            if (!currentTable) {
              currentTable = {
                type: 'table',
                headers: [],
                rows: [],
                isHeaderSeparator: false
              };
            }
            
            // 检查是否是表格分隔行（如 |---|---|）
            if (line.match(/^\s*\|[\s\-\|]+\|\s*$/)) {
              currentTable.isHeaderSeparator = true;
            } else {
              const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
              
              if (currentTable.headers.length === 0 && !currentTable.isHeaderSeparator) {
                currentTable.headers = cells;
              } else if (currentTable.isHeaderSeparator) {
                currentTable.rows.push(cells);
              }
            }
            
            // 检查下一行是否还是表格
            if (i + 1 >= lines.length || !lines[i + 1].includes('|')) {
              if (currentTable.headers.length > 0) {
                parsedContent.push(currentTable);
              }
              currentTable = null;
            }
            continue;
          }
          
          // 检查列表项 - 修复编号列表解析
          if (line.match(/^\s*[-*+]\s/) || line.match(/^\s*\d+\.\s/)) {
            const indent = line.match(/^\s*/)[0].length;
            const numberedMatch = line.match(/^\s*(\d+)\.\s/);
            const isNumbered = !!numberedMatch;
            let listMarker = '';
            let content = '';
            
            if (isNumbered) {
              // 编号列表：保存数字编号
              listMarker = numberedMatch[1] + '.';
              content = line.replace(/^\s*\d+\.\s*/, '');
            } else {
              // 无序列表：保存原始标记符号
              const markerMatch = line.match(/^\s*([-*+])\s/);
              listMarker = markerMatch ? markerMatch[1] : '-';
              content = line.replace(/^\s*[-*+]\s*/, '');
            }
            
            parsedContent.push({
              type: 'list',
              content: content,
              indent: indent,
              numbered: isNumbered,
              marker: listMarker
            });
            continue;
          }
          
          // 检查引用
          if (line.match(/^\s*>\s/)) {
            parsedContent.push({
              type: 'quote',
              content: line.replace(/^\s*>\s*/, ''),
              indent: 0
            });
            continue;
          }
          
          // 普通段落
          if (line.trim() !== '') {
            parsedContent.push({
              type: 'paragraph',
              content: line.trim(),
              indent: 0
            });
          } else {
            parsedContent.push({
              type: 'empty',
              content: '',
              indent: 0
            });
          }
        }
        
        return parsedContent;
      }
      
      // 计算实际内容高度的函数
      function calculateActualContentHeight(ctx, reportText, width, theme, customFont) {
        const padding = 40;
        const contentWidth = width - padding * 2;
        let currentY = padding + 20;
    
        // 标题高度
        ctx.font = `bold 32px "${customFont}", serif`;
        currentY += 50; // 标题高度
    
        // 装饰线
        currentY += 40;
    
        // 解析markdown内容
        const parsedContent = parseMarkdownForCanvas(reportText);
        
        // 计算每个元素的高度
        parsedContent.forEach(item => {
          switch (item.type) {
            case 'heading':
              const headingSize = Math.max(24 - (item.level - 1) * 3, 16);
              currentY += headingSize + 15;
              
              // 装饰线高度
              if (item.level <= 2) {
                currentY += 10;
              }
              break;
              
            case 'table':
              // 简单估算表格高度
              if (item.headers && item.headers.length > 0) {
                currentY += 30; // 表头高度
              }
              if (item.rows && item.rows.length > 0) {
                currentY += item.rows.length * 25; // 行高度
              }
              currentY += 20; // 表格间距
              break;
              
            case 'list':
              ctx.font = `14px "${customFont}", serif`;
              const listLines = wrapText(ctx, item.content, contentWidth - item.indent - 30);
              currentY += listLines.length * 20;
              break;
              
            case 'quote':
              ctx.font = `italic 14px "${customFont}", serif`;
              const quoteLines = wrapText(ctx, item.content, contentWidth - 20);
              currentY += quoteLines.length * 22;
              break;
              
            case 'code':
              currentY += 25;
              break;
              
            case 'empty':
              currentY += 15;
              break;
              
            case 'paragraph':
            default:
              ctx.font = `16px "${customFont}", serif`;
              const paragraphLines = wrapText(ctx, item.content, contentWidth);
              currentY += paragraphLines.length * 24 + 8; // 内容高度 + 段落间距
              break;
          }
        });
    
        // 底部标语
        currentY += 20 + 20; // 间距 + 标语高度
    
        return currentY;
      }
      
      // 绘制表格
      function drawTable(ctx, table, x, y, maxWidth, theme, font) {
        const cellPadding = 8;
        const rowHeight = 25;
        const headerHeight = 30;
        
        // 计算列宽
        const columnCount = Math.max(table.headers.length, Math.max(...table.rows.map(row => row.length)));
        const columnWidth = (maxWidth - cellPadding * 2) / columnCount;
        
        let currentY = y;
        
        // 保存当前文本对齐设置
        const originalTextAlign = ctx.textAlign;
        
        // 绘制表头
        if (table.headers.length > 0) {
          // 表头背景
          ctx.fillStyle = theme.colors.accent + '20'; // 半透明背景
          ctx.fillRect(x, currentY, maxWidth, headerHeight);
          
          // 表头边框
          ctx.strokeStyle = theme.colors.accent;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, currentY, maxWidth, headerHeight);
          
          // 表头文字
          ctx.fillStyle = theme.colors.accent;
          ctx.font = `bold 14px "${font}", serif`;
          ctx.textAlign = 'center';
          
          table.headers.forEach((header, index) => {
            const cellX = x + index * columnWidth + columnWidth / 2;
            const cellY = currentY + headerHeight / 2 + 5;
            ctx.fillText(header, cellX, cellY);
            
            // 列分隔线
            if (index < table.headers.length - 1) {
              ctx.beginPath();
              ctx.moveTo(x + (index + 1) * columnWidth, currentY);
              ctx.lineTo(x + (index + 1) * columnWidth, currentY + headerHeight);
              ctx.stroke();
            }
          });
          
          currentY += headerHeight;
        }
        
        // 绘制数据行
        ctx.font = `13px "${font}", serif`;
        ctx.fillStyle = theme.colors.notes;
        
        table.rows.forEach((row, rowIndex) => {
          // 行背景（交替颜色）
          if (rowIndex % 2 === 1) {
            ctx.fillStyle = theme.colors.accent + '10';
            ctx.fillRect(x, currentY, maxWidth, rowHeight);
          }
          
          // 行边框
          ctx.strokeStyle = theme.colors.separatorLine;
          ctx.lineWidth = 1;
          ctx.strokeRect(x, currentY, maxWidth, rowHeight);
          
          // 单元格文字
          ctx.fillStyle = theme.colors.notes;
          
          row.forEach((cell, cellIndex) => {
            if (cellIndex < columnCount) {
              const cellX = x + cellIndex * columnWidth + cellPadding;
              const cellY = currentY + rowHeight / 2 + 5;
              
              // 文本截断处理
              let displayText = cell;
              const maxCellWidth = columnWidth - cellPadding * 2;
              while (ctx.measureText(displayText).width > maxCellWidth && displayText.length > 0) {
                displayText = displayText.slice(0, -1);
              }
              if (displayText !== cell && displayText.length > 0) {
                displayText += '...';
              }
              
              ctx.textAlign = 'left';
              ctx.fillText(displayText, cellX, cellY);
              
              // 列分隔线
              if (cellIndex < columnCount - 1) {
                ctx.strokeStyle = theme.colors.separatorLine;
                ctx.beginPath();
                ctx.moveTo(x + (cellIndex + 1) * columnWidth, currentY);
                ctx.lineTo(x + (cellIndex + 1) * columnWidth, currentY + rowHeight);
                ctx.stroke();
              }
            }
          });
          
          currentY += rowHeight;
        });
        
        // 恢复原始的文本对齐设置
        ctx.textAlign = originalTextAlign;
        
        return currentY - y; // 返回表格的总高度
      }
      
      // 绘制年度总结内容（支持markdown）
      function drawYearlyReportContent(ctx, reportText, width, height, theme, customFont) {
        return new Promise((resolve) => {
          const padding = 40;
          const contentWidth = width - padding * 2;
          let currentY = padding + 20;
    
          // 标题
          ctx.font = `bold 32px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.title;
          ctx.textAlign = 'center';
          ctx.fillText('Memo使用报告', width / 2, currentY);
          currentY += 50;
    
          // 装饰线
          ctx.strokeStyle = theme.colors.decorativeLine;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(width / 2 - 60, currentY);
          ctx.lineTo(width / 2 + 60, currentY);
          ctx.stroke();
          currentY += 40;
    
        // 解析markdown内容
        const parsedContent = parseMarkdownForCanvas(reportText);
        
          // 绘制解析后的内容
          ctx.textAlign = 'left';
          
        parsedContent.forEach(item => {
          switch (item.type) {
            case 'heading':
              const headingSize = Math.max(24 - (item.level - 1) * 3, 16);
                ctx.font = `bold ${headingSize}px "${customFont}", serif`;
                ctx.fillStyle = theme.colors.title;
                ctx.fillText(item.content, padding, currentY);
              currentY += headingSize + 15;
              
                // 在标题下绘制装饰线
              if (item.level <= 2) {
                  const lineWidth = Math.min(ctx.measureText(item.content).width, contentWidth * 0.6);
                  ctx.strokeStyle = theme.colors.decorativeLine;
                  ctx.lineWidth = item.level === 1 ? 2 : 1;
                  ctx.beginPath();
                  ctx.moveTo(padding, currentY - 10);
                  ctx.lineTo(padding + lineWidth, currentY - 10);
                  ctx.stroke();
                currentY += 10;
              }
              break;
              
            case 'table':
                const tableHeight = drawTable(ctx, item, padding, currentY, contentWidth, theme, customFont);
                currentY += tableHeight + 20;
              break;
              
            case 'list':
              ctx.font = `14px "${customFont}", serif`;
                ctx.fillStyle = theme.colors.notes;
                const listX = padding + item.indent + 20;
                const bullet = item.numbered ? item.marker : (item.marker || '◦');
                ctx.textAlign = 'left';
                ctx.fillText(bullet, listX - 15, currentY);
                
                // 换行处理列表内容
              const listLines = wrapText(ctx, item.content, contentWidth - item.indent - 30);
                listLines.forEach((line, index) => {
                  ctx.fillText(line, listX, currentY);
                  currentY += 20;
                });
              break;
              
            case 'quote':
                // 绘制引用块
                ctx.fillStyle = theme.colors.accent + '20';
                const quoteHeight = 25;
                ctx.fillRect(padding - 5, currentY - 15, 5, quoteHeight);
                
              ctx.font = `italic 14px "${customFont}", serif`;
                ctx.fillStyle = theme.colors.excerpt;
              const quoteLines = wrapText(ctx, item.content, contentWidth - 20);
                quoteLines.forEach(line => {
                  ctx.fillText(line, padding + 15, currentY);
                  currentY += 22;
                });
              break;
              
            case 'code':
                // 绘制代码块
                ctx.fillStyle = theme.colors.separatorLine + '30';
                const codeHeight = 22;
                ctx.fillRect(padding, currentY - 15, contentWidth, codeHeight);
                
                ctx.font = `13px "Courier New", monospace`;
                ctx.fillStyle = theme.colors.notes;
                ctx.fillText(item.content, padding + 10, currentY);
              currentY += 25;
              break;
              
            case 'empty':
                currentY += 15; // 空行间距
              break;
              
            case 'paragraph':
            default:
          ctx.font = `16px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.notes;
                
              const paragraphLines = wrapText(ctx, item.content, contentWidth);
                paragraphLines.forEach(line => {
              ctx.fillText(line, padding, currentY);
                  currentY += 24;
                });
                currentY += 8; // 段落间距
              break;
            }
          });
    
          // 底部标语
          currentY += 20;
          ctx.font = `14px "${customFont}", serif`;
          ctx.fillStyle = theme.colors.brand;
          ctx.textAlign = 'center';
          ctx.fillText('- 来自酒馆Memo -', width / 2, currentY + 20);
    
          resolve();
        });
      }
      // 渲染LLM设置界面
      function renderLLMSettings() {
        // 设置当前视图状态
        state.currentView = 'llm-settings';
      
        // 确保加载最新配置
        loadLLMConfig();
      
        modalTitleElement.textContent = 'LLM设置';
      
        const html = `
          <div class="memo-form">
            <div style="margin-bottom: 12px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7)); font-size: 14px; line-height: 1.4;">
              配置LLM API以生成使用报告。部分gemini反代不支持。
            </div>
            
            <div class="memo-form-group">
              <label class="memo-form-label" for="llmApiUrl">基础URL：</label>
              <input type="text" id="llmApiUrl" 
                     placeholder="输入你的API地址" 
                     value="${escapeHtml(state.llmConfig.apiUrl)}"
                     style="padding: 12px 16px;
                            border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                            border-radius: 10px;
                            background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                            color: var(--SmartThemeBodyColor, #ffffff);
                            font-size: 14px;
                            transition: all 0.3s ease;
                            font-weight: 500;
                            width: 100%;
                            box-sizing: border-box;" />
            </div>
            
            <div class="memo-form-group">
              <label class="memo-form-label" for="llmApiKey">API密钥：</label>
              <input type="password" id="llmApiKey" 
                     placeholder="输入您的API密钥" 
                     value="${escapeHtml(state.llmConfig.apiKey)}"
                     style="padding: 12px 16px;
                            border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                            border-radius: 10px;
                            background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                            color: var(--SmartThemeBodyColor, #ffffff);
                            font-size: 14px;
                            transition: all 0.3s ease;
                            font-weight: 500;
                            width: 100%;
                            box-sizing: border-box;" />
            </div>
            
            <div style="display: flex; gap: 15px; margin-bottom: 15px;">
              <button id="fetchModelsBtn" class="memo-button secondary" style="flex: 1;">
                获取模型列表
              </button>
              <button id="testConnectionBtn" class="memo-button secondary" style="flex: 1;">
                测试连接
              </button>
            </div>
            
            <div class="memo-form-group">
              <label class="memo-form-label" for="llmModel">选择模型：</label>
              <select id="llmModel" 
                      style="padding: 12px 16px;
                             border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                             border-radius: 10px;
                             background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                             color: var(--SmartThemeBodyColor, #ffffff);
                             font-size: 14px;
                             transition: all 0.3s ease;
                             font-weight: 500;
                             width: 100%;
                             box-sizing: border-box;">
                <option value="">请先获取模型列表</option>
                ${state.llmConfig.availableModels.map(model => `
                  <option value="${model}" ${model === state.llmConfig.model ? 'selected' : ''}>
                    ${model}
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div class="memo-form-group">
              <label class="memo-form-label" for="llmTemperature">温度参数 (0-1)：</label>
              <input type="number" id="llmTemperature" 
                     min="0" max="1" step="0.1"
                     placeholder="0.7" 
                     value="${state.llmConfig.temperature}"
                     style="padding: 12px 16px;
                            border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                            border-radius: 10px;
                            background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                            color: var(--SmartThemeBodyColor, #ffffff);
                            font-size: 14px;
                            transition: all 0.3s ease;
                            font-weight: 500;
                            width: 100%;
                            box-sizing: border-box;" />
              <div style="margin-top: 5px; font-size: 12px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.5));">
                较高的值会让输出更随机，较低的值会让输出更确定
              </div>
            </div>
            
            <div id="llmTestStatus" style="
              margin-top: 12px;
              padding: 10px;
              border-radius: 8px;
              background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
              color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
              font-size: 12px;
              text-align: center;
              display: none;
            ">状态显示区域</div>
          </div>
        `;
      
        modalBodyElement.innerHTML = html;
      
        // 绑定输入框样式
        ['llmApiUrl', 'llmApiKey', 'llmModel', 'llmTemperature'].forEach(id => {
          const input = MemoDoc.getElementById(id);
          if (input) {
            input.addEventListener('focus', function () {
              this.style.borderColor = 'var(--SmartThemeQuoteColor, #4a9eff)';
              this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08))';
              this.style.boxShadow = '0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2))';
            });
            input.addEventListener('blur', function () {
              this.style.borderColor = 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';
              this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))';
              this.style.boxShadow = 'none';
            });
          }
        });
      
        // 绑定按钮事件
        const fetchModelsBtn = MemoDoc.getElementById('fetchModelsBtn');
        const testConnectionBtn = MemoDoc.getElementById('testConnectionBtn');
        const statusElem = MemoDoc.getElementById('llmTestStatus');
      
        if (fetchModelsBtn) {
          fetchModelsBtn.addEventListener('click', async () => {
            let apiUrl = MemoDoc.getElementById('llmApiUrl').value.trim();
            const apiKey = MemoDoc.getElementById('llmApiKey').value.trim();
            
            if (!apiUrl || !apiKey) {
              toastr.error('请先填写API地址和密钥');
              return;
            }
    
            // 自动添加 /chat/completions
            apiUrl = apiUrl + '/chat/completions';
      
            fetchModelsBtn.disabled = true;
            fetchModelsBtn.textContent = '获取中...';
            statusElem.style.display = 'block';
            statusElem.textContent = '正在获取模型列表...';
      
            try {
              const models = await fetchAvailableModels(apiUrl, apiKey);
              state.llmConfig.availableModels = models;
              
              // 更新模型选择器
              const modelSelect = MemoDoc.getElementById('llmModel');
              modelSelect.innerHTML = models.map(model => `
                <option value="${model}">${model}</option>
              `).join('');
              
              statusElem.textContent = `✅ 成功获取到 ${models.length} 个模型`;
              statusElem.style.color = 'var(--SmartThemeQuoteColor, #4a9eff)';
              toastr.success(`获取到 ${models.length} 个可用模型`);
            } catch (error) {
              statusElem.textContent = `❌ 获取模型列表失败: ${error.message}`;
              statusElem.style.color = '#ff4757';
              toastr.error('获取模型列表失败');
            } finally {
              fetchModelsBtn.disabled = false;
              fetchModelsBtn.textContent = '获取模型列表';
            }
          });
        }
      
        if (testConnectionBtn) {
          testConnectionBtn.addEventListener('click', async () => {
            let apiUrl = MemoDoc.getElementById('llmApiUrl').value.trim();
            const apiKey = MemoDoc.getElementById('llmApiKey').value.trim();
            
            if (!apiUrl || !apiKey) {
              toastr.error('请先填写API地址和密钥');
              return;
            }
    
            // 自动添加 /chat/completions
            apiUrl = apiUrl + '/chat/completions';
      
            testConnectionBtn.disabled = true;
            testConnectionBtn.textContent = '测试中...';
            statusElem.style.display = 'block';
            statusElem.textContent = '正在测试连接...';
      
            try {
              const result = await testLLMConnection(apiUrl, apiKey);
              if (result.success) {
                statusElem.textContent = '✅ 连接测试成功！';
                statusElem.style.color = 'var(--SmartThemeQuoteColor, #4a9eff)';
                toastr.success('LLM连接测试成功！');
              } else {
                statusElem.textContent = `❌ 连接测试失败: ${result.error}`;
                statusElem.style.color = '#ff4757';
                toastr.error('连接测试失败');
              }
            } catch (error) {
              statusElem.textContent = `❌ 测试出错: ${error.message}`;
              statusElem.style.color = '#ff4757';
              toastr.error('连接测试失败');
            } finally {
              testConnectionBtn.disabled = false;
              testConnectionBtn.textContent = '测试连接';
            }
          });
        }
      
        // 渲染底部按钮
        modalFooterElement.innerHTML = '';
        modalFooterElement.appendChild(createButton('保存设置', 'primary', saveLLMSettingsAndReturn));
        modalFooterElement.appendChild(createButton('返回', 'secondary', () => renderYearlyReportGenerator()));
      
        // 重新居中模态框
        requestAnimationFrame(() => {
          centerModal();
        });
      }
      
      // 保存LLM设置并返回列表
      function saveLLMSettingsAndReturn() {
        let apiUrl = MemoDoc.getElementById('llmApiUrl')?.value?.trim() || '';
        const apiKey = MemoDoc.getElementById('llmApiKey')?.value?.trim() || '';
        const model = MemoDoc.getElementById('llmModel')?.value?.trim() || '';
        const temperature = parseFloat(MemoDoc.getElementById('llmTemperature')?.value) || 0.7;
    
        // 自动添加 /chat/completions
        if (apiUrl) {
          apiUrl = apiUrl + '/chat/completions';
        }
    
        // 更新配置
        const config = {
          apiUrl,
          apiKey,
          model,
          temperature
        };
    
        if (saveLLMConfig(config)) {
          toastr.success('LLM设置已保存');
          // 保存后停留在LLM设置界面
          renderLLMSettings();
        } else {
          toastr.error('保存设置失败');
        }
      }
      
      // 渲染使用报告生成界面
      function renderYearlyReportGenerator() {
        // 设置当前视图状态
        state.currentView = 'yearly-report';
      
        modalTitleElement.textContent = '生成使用报告';
      
        // 获取所有聊天的memo数据
        const allChats = getAllMemoChats();
      
        const html = `
          <div class="memo-form">
            <div style="margin-bottom: 10px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7)); font-size: 14px; line-height: 1.5;">
              选择要包含在使用报告中的对话记录，系统将基于这些Memo生成您的使用报告。
            </div>
            
            <div class="memo-form-group">
              <label class="memo-form-label">选择对话记录：</label>
              <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1)); border-radius: 8px; padding: 10px;">
                ${allChats.length === 0 ? `
                  <div style="text-align: center; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.5)); padding: 20px;">
                    暂无Memo记录
                  </div>
                ` : allChats.map(chat => `
                  <div style="display: flex; align-items: center; margin-bottom: 8px; padding: 8px; border-radius: 6px; background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));">
                    <input type="checkbox" id="chat_${chat.context}" class="chat-checkbox" 
                           style="margin-right: 10px; transform: scale(1.2);" />
                    <label for="chat_${chat.context}" style="flex: 1; cursor: pointer; color: var(--SmartThemeBodyColor, #ffffff);">
                      ${escapeHtml(chat.name)} (${chat.count} 条memo)
                    </label>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div style="display: flex; justify-content: center; margin-top: 15px;">
              <button id="toggleSelectAllChats" class="memo-button secondary" style="min-width: 120px;">
                全选
              </button>
            </div>
            
            <div id="reportGenerationStatus" style="
              margin-top: 15px;
              padding: 10px;
              border-radius: 8px;
              background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
              color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
              font-size: 12px;
              text-align: center;
              display: none;
            ">生成状态显示区域</div>
          </div>
        `;
      
        modalBodyElement.innerHTML = html;
      
        // 绑定事件
        const toggleSelectBtn = MemoDoc.getElementById('toggleSelectAllChats');
        const checkboxes = modalBodyElement.querySelectorAll('.chat-checkbox');
        
        // 检查当前选择状态的函数
        const updateToggleButton = () => {
          const checkedCount = modalBodyElement.querySelectorAll('.chat-checkbox:checked').length;
          const totalCount = checkboxes.length;
          
          if (checkedCount === totalCount && totalCount > 0) {
            // 全选状态
            toggleSelectBtn.textContent = '清空';
            toggleSelectBtn.classList.remove('secondary');
            toggleSelectBtn.classList.add('danger');
          } else {
            // 未全选状态
            toggleSelectBtn.textContent = '全选';
            toggleSelectBtn.classList.remove('danger');
            toggleSelectBtn.classList.add('secondary');
          }
        };
        
        // 切换全选/清空的函数
        const toggleSelectAll = () => {
          const checkedCount = modalBodyElement.querySelectorAll('.chat-checkbox:checked').length;
          const totalCount = checkboxes.length;
          
          if (checkedCount === totalCount && totalCount > 0) {
            // 当前是全选状态，执行清空
            checkboxes.forEach(checkbox => checkbox.checked = false);
          } else {
            // 当前不是全选状态，执行全选
            checkboxes.forEach(checkbox => checkbox.checked = true);
          }
          
          updateToggleButton();
        };
      
        if (toggleSelectBtn) {
          toggleSelectBtn.addEventListener('click', toggleSelectAll);
        }
        
        // 监听单个复选框变化，更新按钮状态
        checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', updateToggleButton);
        });
        
        // 初始化按钮状态
        updateToggleButton();
      
        // 渲染底部按钮
        modalFooterElement.innerHTML = '';
        modalFooterElement.appendChild(createButton('生成报告', 'primary', generateReportFromSelection));
        modalFooterElement.appendChild(createButton('LLM设置', 'secondary', () => renderLLMSettings()));
        modalFooterElement.appendChild(createButton('返回', 'secondary', () => renderMemoList()));
      
        // 重新居中模态框
        requestAnimationFrame(() => {
          centerModal();
        });
      }
      
      // 从选择的对话生成报告
      async function generateReportFromSelection() {
        const checkboxes = modalBodyElement.querySelectorAll('.chat-checkbox:checked');
        const statusElem = MemoDoc.getElementById('reportGenerationStatus');
        
        if (checkboxes.length === 0) {
          toastr.error('请至少选择一个对话记录');
          return;
        }
      
        // 检查LLM配置
        if (!state.llmConfig.apiUrl || !state.llmConfig.apiKey || !state.llmConfig.model) {
          toastr.error('请先完成LLM设置');
          renderLLMSettings();
          return;
        }
      
        try {
          statusElem.style.display = 'block';
          statusElem.textContent = '正在收集Memo数据...';
      
          // 收集选中的memo数据
          const selectedMemos = [];
          checkboxes.forEach(checkbox => {
            const context = checkbox.id.replace('chat_', '');
            const memos = loadMemosFromStorage(context);
            selectedMemos.push(...memos);
          });
      
          if (selectedMemos.length === 0) {
            toastr.error('选中的对话没有Memo记录');
            return;
          }
      
          // 生成报告
          const reportText = await generateYearlyReport(selectedMemos, (status) => {
            statusElem.textContent = status;
          });
      
          statusElem.textContent = '正在生成长图...';
      
          // 生成长图
          const imageDataUrl = await generateYearlyReportImage(reportText);
      
          // 显示结果
          showYearlyReportResult(reportText, imageDataUrl);
      
        } catch (error) {
          console.error('生成使用报告失败:', error);
          statusElem.textContent = `❌ 生成失败: ${error.message}`;
          statusElem.style.color = '#ff4757';
          toastr.error('生成使用报告失败: ' + error.message);
        }
      }
      
      // 显示使用报告结果
      function showYearlyReportResult(reportText, imageDataUrl) {
        state.currentView = 'yearly-report-result';
      
        // 保存当前报告文本和图片数据
        state.currentReportText = reportText;
        state.currentReportImageUrl = imageDataUrl;
      
        // 加载当前样式和字体配置
        const currentStyle = loadStylePreference();
        const currentFont = loadFontPreference();
        
        // 创建字体选项列表 - 只保留默认字体和已加载的网络字体
        const fontOptions = [
          { value: 'QiushuiShotai', name: '秋水书体', description: '默认' }
        ];
        
        // 添加已加载的网络字体
        for (const fontName of state.fontConfig.loadedFonts) {
          if (fontName !== 'QiushuiShotai') {
            fontOptions.push({
              value: fontName,
              name: fontName,
              description: '网络字体'
            });
          }
        }
    
        modalTitleElement.textContent = '使用报告';
    
        const html = `
          <div style="display: flex; flex-direction: column; gap: 20px;">
            <!-- 文本编辑区域 -->
            <div class="memo-form-group">
              <label class="memo-form-label">编辑报告内容：</label>
              <textarea id="reportTextEditor" 
                        style="width: 100%; 
                               height: 200px; 
                               padding: 12px; 
                               border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1)); 
                               border-radius: 8px; 
                               background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05)); 
                               color: var(--SmartThemeBodyColor, #ffffff); 
                               font-family: inherit; 
                               font-size: 14px; 
                               line-height: 1.6; 
                               resize: vertical; 
                               box-sizing: border-box;"
                        placeholder="在这里编辑您的使用报告内容...">${escapeHtml(reportText)}</textarea>
            </div>
            
            <!-- 样式和字体选择器 -->
            <div style="margin-bottom: 20px; display: flex; flex-direction: column; gap: 16px;">
              <!-- 样式选择器行 -->
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <label style="color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 14px; font-weight: 500; min-width: 80px;">
                  卡片样式：
                </label>
                <select id="reportStyleSelector" style="
                  padding: 8px 12px;
                  border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                  border-radius: 8px;
                  background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                  color: var(--SmartThemeBodyColor, #ffffff);
                  font-size: 14px;
                  cursor: pointer;
                  transition: all 0.3s ease;
                  min-width: 160px;
                  appearance: none;
                  -webkit-appearance: none;
                  -moz-appearance: none;
                  background-image: url(\"data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6,9 12,15 18,9'></polyline></svg>\");
                  background-repeat: no-repeat;
                  background-position: right 8px center;
                  background-size: 16px;
                  padding-right: 32px;
                ">
                  <option value="summer" ${currentStyle === 'summer' ? 'selected' : ''}>长夏 - 绿色</option>
                  <option value="marshmallow" ${currentStyle === 'marshmallow' ? 'selected' : ''}>棉花糖 - 粉蓝</option>
                  <option value="drowninlove" ${currentStyle === 'drowninlove' ? 'selected' : ''}>泥沼中 - 青黑</option> 
                  <option value="papper" ${currentStyle === 'papper' ? 'selected' : ''}>如是说 - 信纸</option>
                  <option value="rose" ${currentStyle === 'rose' ? 'selected' : ''}>朱砂痣 - 朱红</option>
                  <option value="ink" ${currentStyle === 'ink' ? 'selected' : ''}>缓缓 - 淡墨</option>
                  <option value="custom" ${currentStyle === 'custom' ? 'selected' : ''}>自定义配色</option>
                </select>
              </div>
              
              <!-- 字体选择器行 -->
              <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                <label style="color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 14px; font-weight: 500; min-width: 80px;">
                  字体选择：
                </label>
                <select id="reportFontSelector" style="
                  padding: 8px 12px;
                  border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                  border-radius: 8px;
                  background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                  color: var(--SmartThemeBodyColor, #ffffff);
                  font-size: 14px;
                  cursor: pointer;
                  transition: all 0.3s ease;
                  min-width: 160px;
                  appearance: none;
                  -webkit-appearance: none;
                  -moz-appearance: none;
                  background-image: url(\"data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6,9 12,15 18,9'></polyline></svg>\");
                  background-repeat: no-repeat;
                  background-position: right 8px center;
                  background-size: 16px;
                  padding-right: 32px;
                ">
                  ${fontOptions.map(option => `
                    <option value="${option.value}" ${option.value === currentFont ? 'selected' : ''}>
                      ${option.name} - ${option.description}
                    </option>
                  `).join('')}
                </select>
              </div>
              
              <!-- CSS字体URL输入行 -->
              <div class="memo-form-group">
                <label class="memo-form-label">加载网络字体：</label>
                <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                  <input type="text" id="reportFontUrlInput" placeholder="输入CSS字体URL或@import链接..." style="
                    flex: 1;
                    min-width: 300px;
                    padding: 8px 12px;
                    border: 2px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                    border-radius: 6px;
                    background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
                    color: var(--SmartThemeBodyColor, #ffffff);
                    font-size: 14px;
                    transition: all 0.3s ease;
                  " />
                  
                  <button id="reportLoadFontBtn" style="
                    padding: 8px 16px;
                    background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.7));
                    color: var(--SmartThemeBodyColor, #ffffff);
                    border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.4));
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(74, 158, 255, 0.15);
                    white-space: nowrap;
                  ">
                    <i class="fas fa-link" style="margin-right: 6px; font-size: 12px;"></i>
                    加载字体
                  </button>
                </div>
              </div>
              
              <!-- 重新生成按钮 -->
              <div style="display: flex; justify-content: center; margin-top: 8px;">
                <button id="regenerateImageBtn" class="memo-button secondary" style="min-width: 140px;">
                  重新生成报告
                </button>
              </div>
              
              <!-- 自定义配色配置区域 -->
              <div id="customColorConfigContainer" style="
                display: none;
                margin-top: 16px;
                padding: 16px;
                border: 2px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2));
                border-radius: 8px;
                background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
              ">
                <h4 style="margin: 0 0 12px 0; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.9)); font-size: 14px;">
                  自定义配色设置
                </h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                  <div>
                    <label style="display: block; margin-bottom: 4px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 12px;">
                      背景色1（左上）
                    </label>
                    <input type="color" id="reportCustomColor1" value="${state.customColorConfig.color1}" style="
                      width: 100%;
                      height: 36px;
                      border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                      border-radius: 4px;
                      background: transparent;
                      cursor: pointer;
                    " />
                  </div>
                  <div>
                    <label style="display: block; margin-bottom: 4px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 12px;">
                      背景色2（右下）
                    </label>
                    <input type="color" id="reportCustomColor2" value="${state.customColorConfig.color2}" style="
                      width: 100%;
                      height: 36px;
                      border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                      border-radius: 4px;
                      background: transparent;
                      cursor: pointer;
                    " />
                  </div>
                </div>
                
                <div>
                  <label style="display: block; margin-bottom: 4px; color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.8)); font-size: 12px;">
                    字体颜色
                  </label>
                  <input type="color" id="reportCustomFontColor" value="${state.customColorConfig.fontColor}" style="
                    width: 100%;
                    height: 36px;
                    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
                    border-radius: 4px;
                    background: transparent;
                    cursor: pointer;
                  " />
                </div>
                
                <div style="margin-top: 12px; text-align: center;">
                  <button id="reportApplyCustomColorsBtn" style="
                    padding: 6px 16px;
                    background: var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.7));
                    color: var(--SmartThemeBodyColor, #ffffff);
                    border: 1px solid var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.4));
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                  ">
                    应用配色
                  </button>
                </div>
              </div>
            </div>
            
            <!-- 生成状态显示 -->
            <div id="imageGenerationStatus" style="
              padding: 10px;
              border-radius: 8px;
              background: var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05));
              color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.7));
              font-size: 12px;
              text-align: center;
              display: none;
            ">正在生成长图...</div>
            
            <!-- 长图预览区域 -->
            <div style="text-align: center;">
              <div style="max-height: 400px; 
                          overflow: auto; 
                          border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1)); 
                          border-radius: 8px; 
                          background: #fff; 
                          padding: 10px;">
                <img id="reportImagePreview" 
                     src="${imageDataUrl}" 
                     style="max-width: 100%; height: auto; border-radius: 4px;" 
                     alt="使用报告长图" />
              </div>
            </div>
          </div>
        `;
    
        modalBodyElement.innerHTML = html;
        
        // 绑定事件
        const textEditor = MemoDoc.getElementById('reportTextEditor');
        const styleSelector = MemoDoc.getElementById('reportStyleSelector');
        const fontSelector = MemoDoc.getElementById('reportFontSelector');
        const regenerateBtn = MemoDoc.getElementById('regenerateImageBtn');
        const statusElem = MemoDoc.getElementById('imageGenerationStatus');
        const imagePreview = MemoDoc.getElementById('reportImagePreview');
        
        // CSS字体URL输入框和加载按钮
        const fontUrlInput = MemoDoc.getElementById('reportFontUrlInput');
        const loadFontBtn = MemoDoc.getElementById('reportLoadFontBtn');
        
        // 重新生成报告函数
        const regenerateImage = async () => {
          try {
            const newText = textEditor.value.trim();
            const selectedStyle = styleSelector.value;
            const selectedFont = fontSelector.value;
            
            if (!newText) {
              toastr.error('报告内容不能为空');
              return;
            }
            
            regenerateBtn.disabled = true;
            regenerateBtn.textContent = '生成中...';
            statusElem.style.display = 'block';
            statusElem.textContent = '正在生成长图...';
            
            // 生成新的长图
            const newImageDataUrl = await generateYearlyReportImage(newText, selectedStyle, selectedFont);
            
            // 更新预览图片
            imagePreview.src = newImageDataUrl;
            
            // 更新状态
            state.currentReportText = newText;
            state.currentReportImageUrl = newImageDataUrl;
            
            // 保存样式和字体偏好
            saveStylePreference(selectedStyle);
            saveFontPreference(selectedFont);
            
            statusElem.textContent = '✅ 长图生成成功！';
            statusElem.style.color = 'var(--SmartThemeQuoteColor, #4a9eff)';
            
            setTimeout(() => {
              statusElem.style.display = 'none';
            }, 2000);
            
            toastr.success('长图已更新！');
            
          } catch (error) {
            console.error('重新生成报告失败:', error);
            statusElem.textContent = `❌ 生成失败: ${error.message}`;
            statusElem.style.color = '#ff4757';
            toastr.error('生成长图失败: ' + error.message);
          } finally {
            regenerateBtn.disabled = false;
            regenerateBtn.textContent = '重新生成报告';
          }
        };
        
        // 绑定重新生成按钮事件
        if (regenerateBtn) {
          regenerateBtn.addEventListener('click', regenerateImage);
        }
        
        // 绑定字体加载按钮事件（复用分享卡片中的字体管理函数）
        if (loadFontBtn && fontUrlInput) {
          loadFontBtn.addEventListener('click', () => {
            const fontUrl = fontUrlInput.value.trim();
            if (fontUrl) {
              // 使用现有的字体加载函数
              loadFontFromUrl(fontUrl, fontSelector);
            } else {
              toastr.warning('请输入字体URL或@import链接');
            }
          });
          
          // 支持回车键加载
          fontUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              const fontUrl = fontUrlInput.value.trim();
              if (fontUrl) {
                loadFontFromUrl(fontUrl, fontSelector);
              }
            }
          });
        }
        
        // 绑定输入框样式
        const inputElements = [textEditor, fontUrlInput];
        inputElements.forEach(element => {
          if (element) {
            element.addEventListener('focus', function () {
              this.style.borderColor = 'var(--SmartThemeQuoteColor, #4a9eff)';
              this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.08))';
              this.style.boxShadow = '0 0 0 3px var(--SmartThemeQuoteColor, rgba(74, 158, 255, 0.2))';
            });
            element.addEventListener('blur', function () {
              this.style.borderColor = 'var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1))';
              this.style.background = 'var(--SmartThemeBlurTintColor, rgba(255, 255, 255, 0.05))';
              this.style.boxShadow = 'none';
            });
          }
        });
    
        // 为选择器添加焦点样式
        addSelectFocusStyles('#reportStyleSelector');
        addSelectFocusStyles('#reportFontSelector');
    
        // 渲染底部按钮
        modalFooterElement.innerHTML = '';
        modalFooterElement.appendChild(createButton('下载长图', 'primary', () => downloadYearlyReportImage(state.currentReportImageUrl)));
        modalFooterElement.appendChild(createButton('重新生成报告', 'secondary', () => renderYearlyReportGenerator()));
        modalFooterElement.appendChild(createButton('返回列表', 'secondary', () => renderMemoList()));
    
        // 重新居中模态框
        requestAnimationFrame(() => {
          centerModal();
        });
    
        // 样式选择器事件 - 添加自定义配色展开功能
        styleSelector.addEventListener('change', (e) => {
          const newStyle = e.target.value;
          
          // 显示或隐藏自定义配色配置
          const customColorContainer = MemoDoc.getElementById('customColorConfigContainer');
          if (customColorContainer) {
            if (newStyle === 'custom') {
              customColorContainer.style.display = 'block';
            } else {
              customColorContainer.style.display = 'none';
            }
          }
        });
    
        // 自定义配色相关事件
        const customColorContainer = MemoDoc.getElementById('customColorConfigContainer');
        const reportCustomColor1 = MemoDoc.getElementById('reportCustomColor1');
        const reportCustomColor2 = MemoDoc.getElementById('reportCustomColor2');
        const reportCustomFontColor = MemoDoc.getElementById('reportCustomFontColor');
        const reportApplyCustomColorsBtn = MemoDoc.getElementById('reportApplyCustomColorsBtn');
    
        // 初始化自定义配色显示状态
        if (customColorContainer && styleSelector.value === 'custom') {
          customColorContainer.style.display = 'block';
        }
    
        // 应用自定义配色按钮事件
        if (reportApplyCustomColorsBtn && reportCustomColor1 && reportCustomColor2 && reportCustomFontColor) {
          reportApplyCustomColorsBtn.addEventListener('click', () => {
            // 更新自定义配色配置
            state.customColorConfig.color1 = reportCustomColor1.value;
            state.customColorConfig.color2 = reportCustomColor2.value;
            state.customColorConfig.fontColor = reportCustomFontColor.value;
            
            // 保存配置
            saveCustomColorConfig(state.customColorConfig);
            
            // 如果当前选择的是自定义配色，重新生成图片
            if (styleSelector.value === 'custom') {
              regenerateImage();
            }
            
            toastr.success('自定义配色已应用！');
          });
        }
      }
      
      // 下载使用报告长图
      function downloadYearlyReportImage(imageDataUrl) {
        try {
          const timestamp = new Date().toISOString().slice(0, 16).replace(/[:\-]/g, '');
          const fileName = `memo_usage_report_${timestamp}.png`;
      
          const link = MemoDoc.createElement('a');
          link.href = imageDataUrl;
          link.download = fileName;
      
          MemoDoc.body.appendChild(link);
          link.click();
          MemoDoc.body.removeChild(link);
      
          toastr.success('使用报告长图已下载！');
        } catch (error) {
          console.error('下载使用报告长图失败:', error);
          toastr.error('下载失败，请重试');
        }
      }
    })();