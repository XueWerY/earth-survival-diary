package com.earthsurvivaldiary.app.plugins;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Collections;

@CapacitorPlugin(name = "HttpServer")
public class HttpServerPlugin extends Plugin {
    private ServerThread serverThread;

    @PluginMethod
    public void startServer(PluginCall call) {
        String dataJson = call.getString("data");
        int port = call.getInt("port", 5789);

        if (dataJson == null) {
            call.reject("data is required");
            return;
        }

        stopServerInternal();

        try {
            serverThread = new ServerThread(port, dataJson);
            serverThread.start();

            // wait for server to start
            Thread.sleep(300);

            String ip = getLocalIpAddress();
            if (ip == null) ip = "127.0.0.1";

            JSObject result = new JSObject();
            result.put("ip", ip);
            result.put("port", port);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start server: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        stopServerInternal();
        call.resolve();
    }

    private void stopServerInternal() {
        if (serverThread != null) {
            serverThread.stopServer();
            serverThread = null;
        }
    }

    private String getLocalIpAddress() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (ni.isLoopback() || !ni.isUp()) continue;
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private static class ServerThread extends Thread {
        private ServerSocket serverSocket;
        private final int port;
        private final String dataJson;
        private volatile boolean running = true;

        ServerThread(int port, String dataJson) {
            this.port = port;
            this.dataJson = dataJson;
        }

        @Override
        public void run() {
            try {
                serverSocket = new ServerSocket(port);
                while (running) {
                    try {
                        Socket client = serverSocket.accept();
                        new Thread(new ClientHandler(client, dataJson)).start();
                    } catch (Exception e) {
                        if (running) break;
                    }
                }
            } catch (Exception ignored) {}
        }

        void stopServer() {
            running = false;
            try { if (serverSocket != null) serverSocket.close(); } catch (Exception ignored) {}
        }
    }

    private static class ClientHandler implements Runnable {
        private final Socket socket;
        private final String dataJson;

        ClientHandler(Socket socket, String dataJson) {
            this.socket = socket;
            this.dataJson = dataJson;
        }

        @Override
        public void run() {
            try {
                BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                String requestLine = reader.readLine();
                if (requestLine == null) {
                    socket.close();
                    return;
                }

                // consume headers
                String line;
                do { line = reader.readLine(); } while (line != null && !line.isEmpty());

                String method = requestLine.split(" ")[0];
                String path = requestLine.split(" ").length > 1 ? requestLine.split(" ")[1] : "/";

                OutputStream out = socket.getOutputStream();
                byte[] bodyBytes = dataJson.getBytes("UTF-8");

                if ("/api/lan-export".equals(path) && "GET".equals(method)) {
                    String header = "HTTP/1.1 200 OK\r\n" +
                        "Content-Type: application/json\r\n" +
                        "Access-Control-Allow-Origin: *\r\n" +
                        "Content-Length: " + bodyBytes.length + "\r\n" +
                        "Connection: close\r\n\r\n";
                    out.write(header.getBytes("UTF-8"));
                    out.write(bodyBytes);
                } else if ("OPTIONS".equals(method)) {
                    String resp = "HTTP/1.1 204 No Content\r\n" +
                        "Access-Control-Allow-Origin: *\r\n" +
                        "Access-Control-Allow-Methods: GET, OPTIONS\r\n" +
                        "Access-Control-Allow-Headers: *\r\n" +
                        "Connection: close\r\n\r\n";
                    out.write(resp.getBytes("UTF-8"));
                } else {
                    String resp = "HTTP/1.1 404 Not Found\r\n" +
                        "Content-Type: text/plain\r\n" +
                        "Connection: close\r\n\r\nNot Found";
                    out.write(resp.getBytes("UTF-8"));
                }

                out.flush();
                socket.close();
            } catch (Exception ignored) {
                try { socket.close(); } catch (Exception ignored2) {}
            }
        }
    }
}