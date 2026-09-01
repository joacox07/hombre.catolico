# Cerebro editorial propio (Codex)

Este servicio reemplaza **sólo** las llamadas de texto del pipeline. Es propio del proyecto:
no instala Hermes, no usa cookies ni automatiza `chatgpt.com`. Ejecuta el CLI oficial de Codex
con una sesión de ChatGPT iniciada por vos en la máquina que lo aloja.

## Dónde se aloja

- **Ahora, sin costo:** en tu PC. Funciona mientras la PC esté encendida.
- **Producción recomendada:** tu VM Always Free de Oracle, cuando recuperes el segundo factor.
- **No en Vercel:** Vercel escala sus funciones a cero, tiene filesystem efímero y duración
  máxima; es excelente para el panel, no para conservar el runtime y la sesión de Codex.

El servicio sólo escucha en `127.0.0.1`. En Oracle se publica detrás de Caddy/Nginx con HTTPS;
en una PC se puede usar un túnel autenticado. Nunca exponer el puerto 8787 directamente.

## Preparación de la máquina anfitriona

1. Instalar Node 20+ y el CLI oficial `codex`.
2. Crear un usuario de sistema exclusivo, por ejemplo `hombre-cerebro`.
3. Con ese usuario, iniciar una sola vez el login oficial: `codex login --device-auth`.
4. Crear un secreto aleatorio de al menos 32 caracteres para `CODEX_GATEWAY_TOKEN`.
5. Ejecutar: `CODEX_GATEWAY_TOKEN='...' node cerebro/server.mjs`.
6. Verificar localmente: `curl http://127.0.0.1:8787/healthz`.

El `CODEX_HOME` de ese usuario contiene la sesión renovable: no se sube a GitHub, Vercel ni se
copia como variable de entorno. Si venciera o se revocara, se repite únicamente el login oficial.

## Host temporal de esta PC

Mientras no haya una VM propia, se puede mantener el panel móvil operativo con esta PC encendida.
El supervisor abre un relay SSH efímero, conserva el gateway en `localhost` y actualiza
automáticamente **sólo** la variable `CODEX_GATEWAY_URL` de GitHub Actions si el relay cambia:

```bash
CONFIG_FILE=/ruta/absoluta/al/.env.local bash cerebro/host-temporal.sh
```

Requiere que esta PC tenga `codex` autenticado, `gh` autenticado para este repo y permanezca
encendida. Es una solución temporal de prueba: una VM propia con un túnel nombrado o VPN es el
reemplazo estable; ni el secreto del gateway ni la clave de imágenes se imprimen o se envían al
navegador.

## Conexión del pipeline

Cuando el host tenga una URL HTTPS privada, configurar en **GitHub Actions**:

- Variable: `TEXT_PROVIDER=codex_gateway`
- Variable: `CODEX_GATEWAY_URL=https://tu-host.example/v1`
- Secret: `CODEX_GATEWAY_TOKEN=<el mismo secreto del gateway>`

`OPENAI_API_KEY` continúa en GitHub y se usa sólo si una pieza requiere generar imagen IA.
Para volver al comportamiento anterior, quitar `TEXT_PROVIDER` o poner `openai`.

## Operación y límites

El gateway procesa una solicitud a la vez: el pipeline ya genera las piezas de forma secuencial.
Si Codex informa límite de uso, el lote falla sin producir una pieza a medias; se reintenta más
tarde desde el panel. Antes de activar el cron semanal se debe comparar un lote de tres piezas
contra el flujo actual y conservar revisión humana y verificación determinista de citas.
