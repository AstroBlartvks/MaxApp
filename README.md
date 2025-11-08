# Max Photo App - Фотогалерея для Max

Приложение-фотогалерея для мессенджера Max с красивым интерфейсом и удобным управлением.

### Установка зависимостей

```bash
npm install max-ui
npm install qrcode
```

**Для Windows:** Если при запуске возникает ошибка с пакетом `@esbuild/win32-x64`, выполните:

```bash
npm install --no-save @esbuild/win32-x64
```

### Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

### Сборка для продакшена

```bash
npm run build
```

Проект создан для мессенджера Max с использованием официальной библиотеки компонентов [@maxhub/max-ui](https://dev.max.ru/ui).
