package com.earthsurvivaldiary.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.earthsurvivaldiary.app.plugins.HttpServerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 必须在 super.onCreate() 之前注册自定义插件，因为父类的 onCreate() 会创建 bridge
        registerPlugin(HttpServerPlugin.class);
        super.onCreate(savedInstanceState);

        // 开启全屏显示（内容延伸至系统状态栏和导航栏下方）
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        WindowCompat.setDecorFitsSystemWindows(window, false);
    }
}