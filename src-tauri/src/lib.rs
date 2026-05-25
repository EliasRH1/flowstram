use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtensionMeta {
    pub name: String,
    pub sites: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Extension {
    pub name: String,
    pub sites: Vec<String>,
    pub file_path: PathBuf,
    pub js_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub year: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub poster: String,
    pub description: String,
    #[serde(skip)]
    pub ext_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamInfo {
    pub url: String,
    pub quality: String,
    pub server: String,
}

pub struct AppState {
    pub extensions: Mutex<Vec<Extension>>,
}

fn get_extensions_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/arch".to_string());
    PathBuf::from(home).join("streaming-app/extensions")
}

fn get_extension_meta(js_code: &str) -> Result<ExtensionMeta, String> {
    let runtime = rquickjs::Runtime::new().map_err(|e| format!("Runtime: {}", e))?;
    let context = rquickjs::Context::full(&runtime).map_err(|e| format!("Context: {}", e))?;

    context.with(|ctx| {
        let value: rquickjs::Value = ctx
            .eval(js_code)
            .map_err(|e| format!("Error evaluando JS: {}", e))?;

        let obj = value
            .as_object()
            .ok_or_else(|| "La extensión debe devolver un objeto".to_string())?;

        let name: String = obj
            .get("name")
            .map_err(|e| format!("Error leyendo name: {}", e))?;

        let sites: Vec<String> = obj
            .get("sites")
            .map_err(|e| format!("Error leyendo sites: {}", e))?;

        Ok(ExtensionMeta { name, sites })
    })
}

#[tauri::command]
fn get_extensions(state: State<AppState>) -> Result<Vec<ExtensionMeta>, String> {
    let extensions = state.extensions.lock().map_err(|e| e.to_string())?;
    Ok(extensions
        .iter()
        .map(|e| ExtensionMeta {
            name: e.name.clone(),
            sites: e.sites.clone(),
        })
        .collect())
}

#[tauri::command]
fn add_extension(state: State<AppState>, url: String) -> Result<(), String> {
    let resp = reqwest::blocking::get(&url)
        .map_err(|e| format!("Error descargando extensión: {}", e))?;
    let js_code = resp
        .text()
        .map_err(|e| format!("Error leyendo respuesta: {}", e))?;

    let meta = get_extension_meta(&js_code)?;

    let file_name = format!("{}.js", meta.name.to_lowercase().replace(' ', "_"));
    let file_path = get_extensions_dir().join(&file_name);
    std::fs::write(&file_path, &js_code)
        .map_err(|e| format!("Error guardando extensión: {}", e))?;

    let ext = Extension {
        name: meta.name,
        sites: meta.sites,
        file_path,
        js_code,
    };

    let mut extensions = state.extensions.lock().map_err(|e| e.to_string())?;
    extensions.push(ext);

    Ok(())
}

#[tauri::command]
fn remove_extension(state: State<AppState>, index: usize) -> Result<(), String> {
    let mut extensions = state.extensions.lock().map_err(|e| e.to_string())?;
    if index < extensions.len() {
        let ext = extensions.remove(index);
        let _ = std::fs::remove_file(&ext.file_path);
    }
    Ok(())
}

fn eval_search(js_code: &str, query: &str) -> Result<Vec<SearchResult>, String> {
    let runtime = rquickjs::Runtime::new().map_err(|e| format!("Runtime: {}", e))?;
    let context = rquickjs::Context::full(&runtime).map_err(|e| format!("Context: {}", e))?;

    context.with(|ctx| {
        let value: rquickjs::Value = ctx
            .eval(js_code)
            .map_err(|e| format!("Error evaluando: {}", e))?;

        let obj = value
            .as_object()
            .ok_or_else(|| "La extensión debe devolver un objeto".to_string())?;

        let search_fn: rquickjs::Function = obj
            .get("search")
            .map_err(|e| format!("Error obteniendo search: {}", e))?;

        let result: rquickjs::Value = search_fn
            .call((query,))
            .map_err(|e| format!("Error llamando search: {}", e))?;

        let json_str = ctx
            .json_stringify(result)
            .map_err(|e| format!("Error serializando: {}", e))?
            .map(|s| s.to_string().unwrap_or_default())
            .unwrap_or_default();

        let items: Vec<serde_json::Value> = serde_json::from_str(&json_str)
            .map_err(|e| format!("Error parseando JSON: {}", e))?;

        let mut results = Vec::new();
        for item in items {
            results.push(SearchResult {
                id: item.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                title: item.get("title").and_then(|v| v.as_str()).unwrap_or("Sin título").to_string(),
                year: item.get("year").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                media_type: item.get("type").and_then(|v| v.as_str()).unwrap_or("movie").to_string(),
                poster: item.get("poster").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                description: item.get("description").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                ext_index: 0,
            });
        }

        Ok(results)
    })
}

fn eval_get_streams(js_code: &str, id: &str) -> Result<Vec<StreamInfo>, String> {
    let runtime = rquickjs::Runtime::new().map_err(|e| format!("Runtime: {}", e))?;
    let context = rquickjs::Context::full(&runtime).map_err(|e| format!("Context: {}", e))?;

    context.with(|ctx| {
        let value: rquickjs::Value = ctx
            .eval(js_code)
            .map_err(|e| format!("Error evaluando: {}", e))?;

        let obj = value
            .as_object()
            .ok_or_else(|| "La extensión debe devolver un objeto".to_string())?;

        let streams_fn: rquickjs::Function = obj
            .get("getStreams")
            .map_err(|e| format!("Error obteniendo getStreams: {}", e))?;

        let result: rquickjs::Value = streams_fn
            .call((id,))
            .map_err(|e| format!("Error llamando getStreams: {}", e))?;

        let json_str = ctx
            .json_stringify(result)
            .map_err(|e| format!("Error serializando: {}", e))?
            .map(|s| s.to_string().unwrap_or_default())
            .unwrap_or_default();

        let items: Vec<serde_json::Value> = serde_json::from_str(&json_str)
            .map_err(|e| format!("Error parseando JSON: {}", e))?;

        let mut results = Vec::new();
        for item in items {
            results.push(StreamInfo {
                url: item.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                quality: item.get("quality").and_then(|v| v.as_str()).unwrap_or("Auto").to_string(),
                server: item.get("server").and_then(|v| v.as_str()).unwrap_or("Server").to_string(),
            });
        }

        Ok(results)
    })
}

#[tauri::command]
fn search_all(state: State<AppState>, query: String) -> Result<Vec<SearchResult>, String> {
    let extensions = state.extensions.lock().map_err(|e| e.to_string())?;
    let mut all_results = Vec::new();

    for (i, ext) in extensions.iter().enumerate() {
        match eval_search(&ext.js_code, &query) {
            Ok(mut results) => {
                for r in &mut results {
                    r.ext_index = i;
                }
                all_results.extend(results);
            }
            Err(e) => {
                eprintln!("Error en extensión '{}': {}", ext.name, e);
            }
        }
    }

    Ok(all_results)
}

#[tauri::command]
fn get_streams(state: State<AppState>, extension_index: usize, id: String) -> Result<Vec<StreamInfo>, String> {
    let extensions = state.extensions.lock().map_err(|e| e.to_string())?;
    if extension_index >= extensions.len() {
        return Err("Extensión no encontrada".to_string());
    }
    eval_get_streams(&extensions[extension_index].js_code, &id)
}

#[tauri::command]
fn play_with_mpv(url: String) -> Result<(), String> {
    let status = std::process::Command::new("mpv")
        .arg(&url)
        .spawn()
        .map_err(|e| format!("Error lanzando mpv: {}", e))?;
    drop(status);
    Ok(())
}

fn load_extensions_from_disk() -> Vec<Extension> {
    let dir = get_extensions_dir();
    let mut extensions = Vec::new();

    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
        return extensions;
    }

    let entries = match std::fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(_) => return extensions,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("js") {
            continue;
        }
        let js_code = match std::fs::read_to_string(&path) {
            Ok(code) => code,
            Err(_) => continue,
        };
        let meta = match get_extension_meta(&js_code) {
            Ok(meta) => meta,
            Err(e) => {
                eprintln!("Error cargando {:?}: {}", path, e);
                continue;
            }
        };
        extensions.push(Extension {
            name: meta.name,
            sites: meta.sites,
            file_path: path,
            js_code,
        });
    }

    extensions
}

pub fn run() {
    let extensions = load_extensions_from_disk();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            extensions: Mutex::new(extensions),
        })
        .invoke_handler(tauri::generate_handler![
            get_extensions,
            add_extension,
            remove_extension,
            search_all,
            get_streams,
            play_with_mpv,
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar FlowStream");
}
