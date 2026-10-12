# AION 2 Timers — Desktop (Windows)

App de Windows (não oficial) com os timers do AION 2. O aviso aparece **por cima do jogo**, sem tirar o foco dele. Esta é a versão desktop da extensão do Chrome AION 2 Timers, feita com [Tauri 2](https://tauri.app).

## O que faz
- **Overlay sobre o jogo**: um card aparece sempre por cima, transparente e com o clique atravessando para o jogo. Some sozinho depois de alguns segundos. A posição e o tempo na tela são configuráveis.
- **Som** (chime) em cada alerta, além de **notificação do Windows** opcional.
- Fica na **bandeja do sistema**. Fechar a janela só a esconde, e os alertas continuam funcionando.
- **Iniciar com o Windows**, já minimizado na bandeja.
- Os mesmos recursos da extensão: resets diário e semanal, bosses do Abyss, Watcher Kaira, Rift contest, **Odyle Energy** e timers personalizados. Todos os eventos podem ser editados.

| Evento | Horário padrão (hora do servidor) |
|---|---|
| Daily Reset | Todo dia 16:00 |
| Weekly Reset | Quarta 16:00 |
| Guardian Lord Nahma | Dom, Sex 21:00 |
| Executor Bosses | Seg, Qui, Sáb 21:30 |
| Watcher Kaira | A cada 180 min a partir de 01:00 |
| Rift of Time & Space Contest (desligado) | Seg, Qui, Sáb 20:00 e 23:00 |

O fuso padrão do servidor é **UTC+9**. Se o reset do jogo não bater, ajuste em **Settings**.

## Modo de tela do jogo
| Modo do AION 2 | Overlay | Som | Notificação do Windows |
|---|---|---|---|
| Janela / Tela cheia sem bordas | ✅ | ✅ | depende do Assistente de Foco |
| Tela cheia exclusiva | ❌ | ✅ | ❌ |

Para ver o overlay, jogue em **janela** ou **tela cheia sem bordas (borderless)**.

O app **não** injeta nada no processo do jogo e não lê memória nem pacotes. É apenas uma janela comum do Windows, então não há risco com o anti-cheat.

## Instalar
1. Baixe o instalador `AION 2 Timers_x.y.z_x64-setup.exe` na página **Releases** do repositório. Ele também fica disponível como artefato `aion2-timers-windows` em cada execução da aba **Actions**.
2. Rode o `AION 2 Timers_x.y.z_x64-setup.exe`. Ele instala só para o seu usuário e não pede administrador.
3. Na primeira execução, o Windows SmartScreen pode avisar que o app não é assinado. Clique em **Mais informações → Executar assim mesmo**.
4. Em **Settings → Alerts**, clique em **Test alert** para ver o overlay e ouvir o som.

## Gerar uma versão (release)
Cada envio para a `main` compila no Windows e publica a Release `v<versão>` com o instalador `.exe` (NSIS) e o `.msi`. A versão vem de `src-tauri/tauri.conf.json`.
- **Nova versão:** aumente `version` em `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` e `package.json`, e envie. Uma nova Release é criada.
- **Mesma versão:** os arquivos da Release existente são substituídos.

## Desenvolver localmente (Windows)
Pré-requisitos: [Rust](https://rustup.rs), Node 20+ e as Build Tools do Visual Studio (C++). O WebView2 já vem no Windows 10/11.
```bash
npm install
npm run dev     # roda com recarga
npm run build   # gera o instalador em src-tauri/target/release/bundle/
```

## Estrutura
```
src/                    # interface web (sem bundler)
  index.html, app.js    # janela principal (portada do popup da extensão)
  schedule.js           # cálculo de horários, igual à extensão (storage → localStorage)
  alarms.js             # monta a lista de alertas e envia para o Rust
  overlay.html/.js/.css # cards exibidos por cima do jogo
src-tauri/
  src/main.rs           # agendador, overlay, som, bandeja, autostart
  sounds/chime.wav      # som do alerta
  tauri.conf.json
.github/workflows/build.yml  # build do instalador Windows
```

### Como os alertas disparam
O WebView2 reduz os timers de janelas escondidas. Por isso a interface calcula os próximos alertas (48 h à frente) e os entrega ao Rust (`set_alarms`). Uma thread em Rust dispara cada alerta na hora certa, mesmo com a janela fechada na bandeja. A lista é reenviada a cada minuto e a cada alteração. Alertas atrasados mais de 5 min, como depois de o PC acordar da suspensão, são descartados.

Não afiliado à NCSOFT.
