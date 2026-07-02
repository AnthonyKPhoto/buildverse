package net.kaiserhomelab.buildverse;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onBackPressed() {
        // Navigate back in the WebView if possible, otherwise exit normally
        if (getBridge() != null
                && getBridge().getWebView() != null
                && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
        } else {
            super.onBackPressed();
        }
    }
}
