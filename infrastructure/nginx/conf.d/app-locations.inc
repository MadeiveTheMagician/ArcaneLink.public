root /usr/share/nginx/html;
index index.html;

proxy_hide_header Strict-Transport-Security;
proxy_hide_header X-Content-Type-Options;
proxy_hide_header Referrer-Policy;
proxy_hide_header X-Frame-Options;
proxy_hide_header Permissions-Policy;
proxy_hide_header Content-Security-Policy;
proxy_hide_header Content-Security-Policy-Report-Only;

include /etc/nginx/snippets/security-headers.inc;

location = /nginx-health {
    access_log off;
    return 204;
}

location / {
    try_files $uri $uri/ /index.html;
}

location ~* \.(?:css|js|mjs|woff2?|png|jpe?g|gif|svg|webp|ico)$ {
    try_files $uri =404;
    include /etc/nginx/snippets/security-headers.inc;
    add_header Cache-Control "public, max-age=604800, immutable" always;
}

location = /downloads/desktop/windows/latest.yml {
    try_files $uri =404;
    include /etc/nginx/snippets/security-headers.inc;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
}

location /downloads/ {
    try_files $uri =404;
    include /etc/nginx/snippets/security-headers.inc;
    add_header Cache-Control "public, max-age=604800, immutable" always;
}

location /api/ {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}

location /hubs/ {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

location /health/ {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /ping {
    proxy_pass http://backend:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
