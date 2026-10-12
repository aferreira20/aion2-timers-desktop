// AION 2 Timers — desktop shell.
//
// The web UI (src/) owns the schedule logic and pushes a flat list of upcoming
// alarms to Rust. A background thread here fires them at the right moment, so
// alerts are on time even when the main window is hidden (WebView2 throttles
// timers in hidden windows). Each alert can show a click-through, always-on-top
// overlay, play a chime and/or raise a Windows notification.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewWindow, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_notification::NotificationExt;

const TRAY_ID: &str = "main-tray";
/// Alarms older than this (e.g. after the PC wakes from sleep) are dropped silently.
const MAX_LATE_MS: i64 = 5 * 60 * 1000;
/// Remember fired alarm ids for a day so a re-sent list does not fire them twice.
const FIRED_TTL_MS: i64 = 24 * 60 * 60 * 1000;
/// Overlay size in logical pixels and distance from the screen edge.
const OVERLAY_W: f64 = 400.0;
const OVERLAY_H: f64 = 480.0;
const OVERLAY_MARGIN: f64 = 24.0;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Alarm {
    id: String,
    at: i64,
    title: String,
    body: String,
    kind: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
struct AlertOptions {
    overlay: bool,
    overlay_seconds: u32,
    position: String,
    sound: bool,
    toast: bool,
    /// Localized text for the "Test alert" action (UI language).
    test_title: String,
    test_body: String,
}

impl Default for AlertOptions {
    fn default() -> Self {
        Self {
            overlay: true,
            overlay_seconds: 12,
            position: "top-right".into(),
            sound: true,
            toast: false,
            test_title: "Test alert".into(),
            test_body: "This is how AION 2 Timers will look over your game.".into(),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OverlayPayload {
    id: String,
    title: String,
    body: String,
    kind: String,
    seconds: u32,
    position: String,
}

#[derive(Default)]
struct Inner {
    alarms: Vec<Alarm>,
    fired: HashMap<String, i64>,
    options: AlertOptions,
}

#[derive(Default)]
struct Scheduler {
    inner: Mutex<Inner>,
    cv: Condvar,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/* ---------------- Commands called from the web UI ---------------- */

#[tauri::command]
fn set_alarms(state: tauri::State<Arc<Scheduler>>, alarms: Vec<Alarm>, options: AlertOptions) {
    let mut g = state.inner.lock().unwrap();
    let now = now_ms();
    g.fired.retain(|_, at| now - *at < FIRED_TTL_MS);
    let fresh: Vec<Alarm> = alarms
        .into_iter()
        .filter(|a| !g.fired.contains_key(&a.id))
        .collect();
    g.alarms = fresh;
    g.options = options;
    state.cv.notify_all();
}

#[tauri::command]
fn test_alert(app: AppHandle, state: tauri::State<Arc<Scheduler>>) {
    let opts = state.inner.lock().unwrap().options.clone();
    fire(&app, &opts, &test_alarm(&opts));
}

/// Rebuild the tray menu with labels in the UI language.
#[tauri::command]
fn set_tray_menu(app: AppHandle, open: String, test: String, quit: String) -> Result<(), String> {
    let menu = tray_menu(&app, &open, &test, &quit).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_tray_tooltip(app: AppHandle, text: String) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(text));
    }
}

#[tauri::command]
fn overlay_hide(app: AppHandle) {
    if let Some(win) = app.get_webview_window("overlay") {
        let _ = win.hide();
    }
}

/* ---------------- Alarm thread ---------------- */

fn scheduler_loop(app: AppHandle, sched: Arc<Scheduler>) {
    loop {
        let (due, opts) = {
            let mut g = sched.inner.lock().unwrap();
            loop {
                let now = now_ms();
                match g.alarms.iter().map(|a| a.at).min() {
                    Some(at) if at <= now => break,
                    // Wake at least every 30 s so wall-clock jumps (sleep, clock sync) are noticed.
                    Some(at) => {
                        let wait = ((at - now) as u64).min(30_000);
                        g = sched.cv.wait_timeout(g, Duration::from_millis(wait)).unwrap().0;
                    }
                    None => {
                        g = sched.cv.wait_timeout(g, Duration::from_secs(30)).unwrap().0;
                    }
                }
            }
            let now = now_ms();
            let (due, rest): (Vec<Alarm>, Vec<Alarm>) =
                std::mem::take(&mut g.alarms).into_iter().partition(|a| a.at <= now);
            g.alarms = rest;
            for a in &due {
                g.fired.insert(a.id.clone(), a.at);
            }
            (due, g.options.clone())
        };

        let now = now_ms();
        for a in due.iter().filter(|a| now - a.at <= MAX_LATE_MS) {
            fire(&app, &opts, a);
        }
        let ids: Vec<String> = due.into_iter().map(|a| a.id).collect();
        let _ = app.emit_to("main", "alarms-fired", ids);
    }
}

fn test_alarm(opts: &AlertOptions) -> Alarm {
    Alarm {
        id: format!("test|{}", now_ms()),
        at: now_ms(),
        title: opts.test_title.clone(),
        body: opts.test_body.clone(),
        kind: "warn".into(),
    }
}

fn fire(app: &AppHandle, opts: &AlertOptions, a: &Alarm) {
    if opts.sound {
        play_chime();
    }
    if opts.toast {
        let _ = app
            .notification()
            .builder()
            .title(a.title.clone())
            .body(a.body.clone())
            .show();
    }
    if opts.overlay {
        show_overlay(app, opts, a);
    }
}

/* ---------------- Overlay ---------------- */

fn show_overlay(app: &AppHandle, opts: &AlertOptions, a: &Alarm) {
    let Some(win) = app.get_webview_window("overlay") else {
        return;
    };
    let position = opts.position.clone();
    let w = win.clone();
    let _ = app.run_on_main_thread(move || {
        place_overlay(&w, &position);
        let _ = w.set_ignore_cursor_events(true);
        let _ = w.show();
        keep_topmost(&w);
    });
    let payload = OverlayPayload {
        id: a.id.clone(),
        title: a.title.clone(),
        body: a.body.clone(),
        kind: a.kind.clone(),
        seconds: opts.overlay_seconds.clamp(3, 300),
        position: opts.position.clone(),
    };
    let _ = app.emit_to("overlay", "overlay:push", payload);
}

/// Put the overlay in a corner (or top centre) of the primary monitor.
fn place_overlay(win: &WebviewWindow, position: &str) {
    let monitor = win
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| win.current_monitor().ok().flatten());
    let Some(m) = monitor else { return };
    let scale = m.scale_factor();
    let _ = win.set_size(LogicalSize::new(OVERLAY_W, OVERLAY_H));

    let (mx, my) = (m.position().x as f64, m.position().y as f64);
    let (mw, mh) = (m.size().width as f64, m.size().height as f64);
    let (w, h, margin) = (OVERLAY_W * scale, OVERLAY_H * scale, OVERLAY_MARGIN * scale);

    let x = if position.ends_with("left") {
        mx + margin
    } else if position.ends_with("center") {
        mx + (mw - w) / 2.0
    } else {
        mx + mw - w - margin
    };
    let y = if position.starts_with("bottom") {
        // Leave room for the taskbar.
        my + mh - h - margin - 48.0 * scale
    } else {
        my + margin
    };
    let _ = win.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32));
}

/// Re-assert HWND_TOPMOST without activating, in case the game also claims topmost.
#[cfg(windows)]
fn keep_topmost(win: &WebviewWindow) {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    };
    let Ok(handle) = win.window_handle() else { return };
    if let RawWindowHandle::Win32(h) = handle.as_raw() {
        let hwnd = h.hwnd.get() as windows_sys::Win32::Foundation::HWND;
        unsafe {
            SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        }
    }
}

#[cfg(not(windows))]
fn keep_topmost(_win: &WebviewWindow) {}

/* ---------------- Sound ---------------- */

#[cfg(windows)]
static CHIME: &[u8] = include_bytes!("../sounds/chime.wav");

#[cfg(windows)]
fn play_chime() {
    use windows_sys::Win32::Media::Audio::{PlaySoundW, SND_ASYNC, SND_MEMORY, SND_NODEFAULT};
    unsafe {
        PlaySoundW(
            CHIME.as_ptr() as *const u16,
            std::ptr::null_mut(),
            SND_MEMORY | SND_ASYNC | SND_NODEFAULT,
        );
    }
}

#[cfg(not(windows))]
fn play_chime() {}

/* ---------------- Main window / tray ---------------- */

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn tray_menu<R: tauri::Runtime, M: Manager<R>>(
    app: &M,
    open: &str,
    test: &str,
    quit: &str,
) -> tauri::Result<Menu<R>> {
    let open = MenuItem::with_id(app, "open", open, true, None::<&str>)?;
    let test = MenuItem::with_id(app, "test", test, true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", quit, true, None::<&str>)?;
    Menu::with_items(app, &[&open, &test, &sep, &quit])
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    // English until the UI sends its language via set_tray_menu.
    let menu = tray_menu(app, "Open AION 2 Timers", "Test alert", "Quit")?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("AION 2 Timers")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "test" => {
                let sched = app.state::<Arc<Scheduler>>();
                let opts = sched.inner.lock().unwrap().options.clone();
                fire(app, &opts, &test_alarm(&opts));
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

fn main() {
    let scheduler = Arc::new(Scheduler::default());

    tauri::Builder::default()
        // Must be first: a second launch just brings the running window forward.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .manage(scheduler.clone())
        .invoke_handler(tauri::generate_handler![
            set_alarms,
            test_alert,
            set_tray_menu,
            set_tray_tooltip,
            overlay_hide
        ])
        .setup(move |app| {
            build_tray(app)?;

            let handle = app.handle().clone();
            let sched = scheduler.clone();
            std::thread::spawn(move || scheduler_loop(handle, sched));

            // Started by Windows at login → stay in the tray.
            if !std::env::args().any(|a| a == "--minimized") {
                show_main(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it to the tray; alarms keep running.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running AION 2 Timers");
}
