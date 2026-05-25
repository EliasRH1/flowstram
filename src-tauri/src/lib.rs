use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub extensions_dir: Mutex<PathBuf>,
}

fn get_extensions_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/arch".to_string());
    let dir = PathBuf::from(home).join(".local/share/flowstream/extensions");
    std::fs::create_dir_all(&dir).ok();
    dir
}

#[tauri::command]
fn get_extensions(state: State<AppState>) -> Result<Vec<String>, String> {
    let dir = state.extensions_dir.lock().map_err(|e| e.to_string())?;
    let mut names = Vec::new();
    if !dir.exists() {
        return Ok(names);
    }
    for entry in std::fs::read_dir(dir.as_path()).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("js") {
            if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                names.push(name.to_string());
            }
        }
    }
    names.sort();
    Ok(names)
}

#[tauri::command]
fn get_extension_code(state: State<AppState>, name: String) -> Result<String, String> {
    let dir = state.extensions_dir.lock().map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.js", name));
    std::fs::read_to_string(&path).map_err(|e| format!("Error leyendo extensión: {}", e))
}

#[tauri::command]
fn add_extension(state: State<AppState>, url: String) -> Result<String, String> {
    let resp = reqwest::blocking::get(&url)
        .map_err(|e| format!("Error descargando: {}", e))?;
    let code = resp.text().map_err(|e| format!("Error leyendo: {}", e))?;

    let name = url
        .split('/')
        .last()
        .unwrap_or("extension.js")
        .replace(".js", "");

    let dir = state.extensions_dir.lock().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(dir.as_path()).ok();
    let path = dir.join(format!("{}.js", name));
    std::fs::write(&path, &code).map_err(|e| format!("Error guardando: {}", e))?;

    Ok(name)
}

#[tauri::command]
fn remove_extension(state: State<AppState>, name: String) -> Result<(), String> {
    let dir = state.extensions_dir.lock().map_err(|e| e.to_string())?;
    let path = dir.join(format!("{}.js", name));
    std::fs::remove_file(&path).ok();
    Ok(())
}

#[tauri::command]
fn play_with_mpv(url: String) -> Result<(), String> {
    std::process::Command::new("mpv")
        .arg(&url)
        .spawn()
        .map_err(|e| format!("Error lanzando mpv: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
        .build()
        .map_err(|e| format!("Error creando cliente: {}", e))?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error fetching: {}", e))?;

    resp.text()
        .await
        .map_err(|e| format!("Error leyendo respuesta: {}", e))
}

pub fn run() {
    let dir = get_extensions_dir();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            extensions_dir: Mutex::new(dir),
        })
        .invoke_handler(tauri::generate_handler![
            get_extensions,
            get_extension_code,
            add_extension,
            remove_extension,
            play_with_mpv,
            fetch_url,
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar FlowStream");
}
