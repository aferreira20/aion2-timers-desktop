# AION 2 Timers — Desktop (Windows)

App de Windows (não oficial) com os timers do AION 2. O aviso aparece **por cima do jogo**, sem tirar o foco dele. Esta é a versão desktop da extensão do Chrome AION 2 Timers, feita com [Tauri 2](https://tauri.app).

## O que faz
- **Overlay sobre o jogo**: um card aparece sempre por cima, transparente e com o clique atravessando para o jogo. Some sozinho depois de alguns segundos.
- **Escolha onde o alerta aparece**: em **Ajustes → Alertas**, clique no canto da tela desejado (superior ou inferior; esquerda, centro ou direita). Ao clicar, um alerta de teste aparece na posição escolhida.
- **Idiomas**: português (Brasil) e inglês, escolhidos em **Ajustes → Idioma**. No modo automático, segue o idioma do Windows.
- **Som** (chime) em cada alerta, além de **notificação do Windows** opcional.
- Fica na **bandeja do sistema**. Fechar a janela só a esconde, e os alertas continuam funcionando.
- **Iniciar com o Windows**, já minimizado na bandeja.
- Todos os timers do [shugo.gg](https://shugo.gg/timers) por região, mais **Odyle Energy** e timers personalizados.

Os horários vêm de [shugo.gg/timers](https://shugo.gg/timers) (levantamento da comunidade; a NCSOFT não publica os horários do Global). Nos servidores **Global** (NA Leste, NA Oeste, Europa, América do Sul, Ásia), os eventos seguem o **relógio local da região** e os resets acontecem no mesmo instante para todos, às 16:00 KST (04:00 em São Paulo). Coreia e Taiwan seguem o próprio relógio. Os fusos são reais, com horário de verão (por exemplo, NA e Europa mudam em 25/10 e 1/11).

| Evento | Global (relógio da região) | Duração | Padrão |
|---|---|---|---|
| Daily Reset | Todo dia 16:00 KST | — | ligado |
| Weekly Reset | Quarta 16:00 KST | — | ligado |
| Spacetime Rift | A cada 3 h a partir de 02:00 (portal nos primeiros 10 min) | 60 min | ligado |
| Watcher Kaira | A cada 3 h a partir de 01:00 | 30 min | ligado |
| Artifact Siege | Seg, Qui, Sáb 21:00 | 30 min | ligado |
| Executores (Tamasa, Argo, Kairah) | Seg, Qui, Sáb 21:30 (**21:40 na América do Sul**) | 30 min | ligado |
| Senhor Guardião Nahma | Dom, Sex 21:00 (**21:10 na América do Sul**) | 30 min | ligado |
| Shugo Festival | Toda hora em :00 | 10 min | desligado |
| Dimensional Invasion | Toda hora em :30 | 15 min | desligado |

Na América do Sul, os horários dos Executores e do Nahma foram conferidos com as contagens do mapa do Abismo no jogo (out/2026). Escolha a região em **Ajustes → Região do servidor**. Na primeira execução ela é detectada pelo fuso do Windows. Eventos em andamento aparecem em verde, com o tempo restante. Todos os eventos podem ser editados, inclusive a duração.

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
4. Em **Ajustes → Alertas** (**Settings → Alerts** em inglês), clique em **Testar alerta** para ver o overlay e ouvir o som.

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
  i18n.js               # traduções (en / pt-BR)
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
