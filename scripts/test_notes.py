from playwright.sync_api import sync_playwright
import sys

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1400, 'height': 900})

    # 收集 console 日志
    logs = []
    page.on('console', lambda msg: logs.append(f'[{msg.type}] {msg.text}'))
    page.on('pageerror', lambda err: logs.append(f'[pageerror] {err}'))

    try:
        page.goto('http://localhost:5173/', wait_until='networkidle', timeout=15000)
        page.wait_for_timeout(1500)
        page.screenshot(path='c:/Project/earth-survival-diary/scripts/shot_home.png', full_page=False)
        print('=== 首页截图完成 ===')

        # 查找笔记模块入口
        notes_link = page.locator('text=笔记').first
        if notes_link.count() > 0:
            notes_link.click()
            page.wait_for_timeout(1500)
            page.screenshot(path='c:/Project/earth-survival-diary/scripts/shot_notes.png', full_page=False)
            print('=== 笔记模块截图完成 ===')
            print('当前 URL:', page.url)
        else:
            print('未找到笔记入口，尝试直接导航')
            page.goto('http://localhost:5173/#/notes', wait_until='networkidle', timeout=15000)
            page.wait_for_timeout(1500)
            page.screenshot(path='c:/Project/earth-survival-diary/scripts/shot_notes.png', full_page=False)
            print('当前 URL:', page.url)

        # 打印 console 日志
        print('\n=== Console 日志 ===')
        for log in logs[-30:]:
            print(log)

    except Exception as e:
        print(f'错误: {e}')
        page.screenshot(path='c:/Project/earth-survival-diary/scripts/shot_error.png', full_page=False)
        print('\n=== Console 日志 ===')
        for log in logs[-30:]:
            print(log)
    finally:
        browser.close()
