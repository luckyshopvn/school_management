package vn.schoolmanagement.demo;

import android.net.Uri;
import android.os.Bundle;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSExport;
import com.getcapacitor.Logger;
import com.getcapacitor.PluginHandle;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

// Vỏ ứng dụng cài đặt (DT-26 phần 26f, YCTD-236). Phần 26g (YCTD-237): Capacitor chỉ chèn cầu nối gốc vào trang khởi động của vỏ;
// trang của trường (ứng dụng giáo viên, phụ huynh) mở ở tên miền được phép (allowNavigation) cần cầu nối để xin quyền thông báo, lấy
// mã thiết bị FCM và nhận sự kiện chạm thông báo. Chèn cầu nối kèm riêng plugin PushNotifications vào các tên miền được phép (cùng danh
// sách Capacitor dùng cho kênh nhận tin của cầu nối), không chèn vào trang nào khác.
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        injectBridgeIntoSchoolPages(getBridge(), firebaseConfigured());
    }

    // Plugin lấy mã FCM qua Firebase; bản dựng không có google-services.json thì Firebase chưa khởi tạo và gọi register làm ứng dụng
    // dừng, nên báo cho trang biết để trang không gọi (tài nguyên google_app_id do plugin google-services sinh từ tệp đó)
    private boolean firebaseConfigured() {
        return getResources().getIdentifier("google_app_id", "string", getPackageName()) != 0;
    }

    private static void injectBridgeIntoSchoolPages(Bridge bridge, boolean firebaseConfigured) {
        if (bridge == null || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            return;
        }
        PluginHandle push = bridge.getPlugin("PushNotifications");
        if (push == null) {
            return;
        }
        String appOrigin = Uri.parse(bridge.getAppUrl()).buildUpon().path(null).fragment(null).clearQuery().build().toString();
        Set<String> origins = new HashSet<>(bridge.getAllowedOriginRules());
        origins.remove(appOrigin);
        origins.remove(bridge.getServerUrl());
        if (origins.isEmpty()) {
            return;
        }
        try {
            String script =
                JSExport.getGlobalJS(bridge.getContext(), bridge.getConfig().isLoggingEnabled(), bridge.isDevMode()) +
                "\n\n" +
                // Trang của trường chuyển về trang khởi động của vỏ khi chạm thông báo của ứng dụng khác
                "window.WEBVIEW_SERVER_URL = '" +
                bridge.getLocalUrl() +
                "';\n" +
                "window.DAY_GOC_SAN_SANG = " +
                firebaseConfigured +
                ";\n\n" +
                JSExport.getBridgeJS(bridge.getContext()) +
                "\n\n" +
                JSExport.getPluginJS(Collections.singletonList(push));
            WebViewCompat.addDocumentStartJavaScript(bridge.getWebView(), script, origins);
        } catch (Exception exception) {
            Logger.error("Không chèn được cầu nối gốc vào trang của trường; đẩy gốc không dùng được", exception);
        }
    }
}
