"""
scripts/blender/generate_lods.py

Skrypt do audytu polycount oraz automatycznego generowania i eksportu uproszczonych siatek LOD1 (Level of Detail)
z biblioteki C:\\Users\\robert\\Documents\\mars-terraform.blend za pomoca Blendera (CLI lub Blender MCP).

Uruchomienie CLI:
  & 'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe' -b 'C:\\Users\\robert\\Documents\\mars-terraform.blend' -P scripts/blender/generate_lods.py

Opcjonalne argumenty CLI:
  --ratio=0.35
  --threshold=350
  --output-dir="public/models/mars"
  --filter="poi_abandoned_lab,turret_double"
"""

import sys
import os
import json
import time
from pathlib import Path

try:
    import bpy
    import mathutils
except ImportError:
    print("ERROR: Ten skrypt musi być uruchomiony wewnątrz Blendera: blender.exe -b <plik.blend> -P <skrypt>")
    sys.exit(1)


if "__file__" in globals():
    WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
else:
    WORKSPACE_ROOT = Path(r"C:\Users\robert\code\mars-terraform")

DEFAULT_OUTPUT_DIR = WORKSPACE_ROOT / "public" / "models" / "mars"
MANIFEST_PATH = WORKSPACE_ROOT / "src" / "domain" / "config" / "assetManifest.json"

# Domyslna lista kluczowych ciezkich assetow do generowania LOD
DEFAULT_TARGET_ASSETS = [
    # POI Prefabs
    "poi_abandoned_lab",
    "poi_alien_hive",
    "poi_crashed_freighter",
    # Buildings & Defense
    "turret_double",
    "turret_single",
    "hangar_largeA",
    "hangar_largeB",
    "barrels_rail",
    # Infrastructure & Decor
    "satelliteDish_detailed",
    "rock_crystalsLargeA",
    "rock_crystalsLargeB",
    "rock_crystals",
    # Heavy Units & Logistics
    "craft_hauler",
    "drone_repair",
    "rover_combat",
]


def parse_args():
    output_dir = DEFAULT_OUTPUT_DIR
    filter_pattern = None
    decimate_ratio = 0.35
    poly_threshold = 350

    if "--" in sys.argv:
        idx = sys.argv.index("--")
        for arg in sys.argv[idx + 1:]:
            if arg.startswith("--output-dir="):
                output_dir = Path(arg.split("=", 1)[1].strip('"\''))
            elif arg.startswith("--filter="):
                filter_pattern = [p.strip() for p in arg.split("=", 1)[1].strip('"\'').split(",")]
            elif arg.startswith("--ratio="):
                decimate_ratio = float(arg.split("=", 1)[1].strip('"\''))
            elif arg.startswith("--threshold="):
                poly_threshold = int(arg.split("=", 1)[1].strip('"\''))

    return output_dir, filter_pattern, decimate_ratio, poly_threshold


def is_asset_collection(col: bpy.types.Collection) -> bool:
    """Sprawdza czy kolekcja jest lisciem reprezentujacym pojedynczy asset"""
    name = col.name
    # Ignorujemy kolekcje pomocnicze i glowne kategorie
    if name.startswith("00_") or name.startswith("99_"):
        return False
    if name.startswith("01_") or name.startswith("02_") or name.startswith("03_") or \
       name.startswith("04_") or name.startswith("05_") or name.startswith("06_"):
        return False
    # Ignorujemy kolekcje podkategorii, ktore maja dzieci (np. Habitation ma dzieci rocket_baseA itp.)
    if len(col.children) > 0:
        return False
    # Musi zawierac co najmniej jeden obiekt siatki
    return any(o.type == 'MESH' for o in col.objects)


def audit_collections():
    """Przeprowadza audyt wszystkich kolekcji pojedynczych assetów pod kątem liczby trójkątów i wierzchołków."""
    audit_results = {}
    for col in bpy.data.collections:
        if not is_asset_collection(col):
            continue
        mesh_objs = [o for o in col.objects if o.type == 'MESH']
        if not mesh_objs:
            continue
        tris = sum(len(o.data.polygons) for o in mesh_objs)
        verts = sum(len(o.data.vertices) for o in mesh_objs)
        audit_results[col.name] = {
            "collection": col.name,
            "mesh_count": len(mesh_objs),
            "triangles": tris,
            "vertices": verts,
        }
    return audit_results


def generate_lod_for_collection(col_name: str, output_dir: Path, ratio: float = 0.35) -> dict | None:
    """Tworzy zredukowany wariant LOD1 danej kolekcji i eksportuje jako {col_name}_lod1.glb."""
    col = bpy.data.collections.get(col_name)
    if not col:
        print(f"WARN: Kolekcja '{col_name}' nie istnieje.")
        return None

    mesh_objs = [o for o in col.all_objects if o.type == 'MESH']
    if not mesh_objs:
        print(f"WARN: Kolekcja '{col_name}' nie zawiera obiektów MESH.")
        return None

    orig_tris = sum(len(o.data.polygons) for o in mesh_objs)
    orig_verts = sum(len(o.data.vertices) for o in mesh_objs)

    # Tworzymy tymczasowa kolekcje robocza
    temp_col_name = f"temp_lod_{col_name}_{int(time.time()*1000)}"
    temp_col = bpy.data.collections.new(temp_col_name)
    bpy.context.scene.collection.children.link(temp_col)

    duplicated_objs = []
    for src_obj in mesh_objs:
        new_obj = src_obj.copy()
        new_obj.data = src_obj.data.copy()
        # Zachowaj relatywna macierz transformacji wzgledem swiata
        new_obj.matrix_world = src_obj.matrix_world.copy()
        temp_col.objects.link(new_obj)
        duplicated_objs.append(new_obj)

        # Aplikujemy modyfikator Decimate
        mod = new_obj.modifiers.new(name="Decimate_LOD", type='DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        mod.use_symmetry = False

    # Zaznaczamy wylacznie obiekty LOD
    bpy.ops.object.select_all(action='DESELECT')
    for obj in duplicated_objs:
        obj.select_set(True)

    # Aplikacja modyfikatora
    for obj in duplicated_objs:
        bpy.context.view_layer.objects.active = obj
        try:
            bpy.ops.object.modifier_apply(modifier="Decimate_LOD")
        except Exception as e:
            print(f"Błąd przy aplikowaniu Decimate dla {obj.name}: {e}")

    lod_tris = sum(len(o.data.polygons) for o in duplicated_objs)
    lod_verts = sum(len(o.data.vertices) for o in duplicated_objs)
    reduction = round((1.0 - (lod_tris / max(1, orig_tris))) * 100.0, 1)

    out_file = output_dir / f"{col_name}_lod1.glb"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Eksport GLB
    bpy.ops.export_scene.gltf(
        filepath=str(out_file),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_draco_mesh_compression_enable=False
    )

    # Czyszczenie obiektow tymczasowych
    for obj in duplicated_objs:
        mesh_data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh_data:
            bpy.data.meshes.remove(mesh_data)
    bpy.data.collections.remove(temp_col)

    file_size = out_file.stat().st_size if out_file.exists() else 0

    print(f" [LOD1] {col_name}: {orig_tris} tris -> {lod_tris} tris (-{reduction}%) | Rozmiar: {file_size} B -> {out_file.name}")

    return {
        "id": col_name,
        "lodPath": f"/models/mars/{col_name}_lod1.glb",
        "originalTriangles": orig_tris,
        "originalVertices": orig_verts,
        "lodTriangles": lod_tris,
        "lodVertices": lod_verts,
        "reductionPercent": reduction,
        "fileSize": file_size,
    }


def update_manifest(lod_results: list[dict]):
    """Aktualizuje assetManifest.json o dane LOD1."""
    if not MANIFEST_PATH.exists():
        print(f"WARN: Plik manifestu {MANIFEST_PATH} nie istnieje.")
        return

    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    lod_map = {res["id"]: res for res in lod_results}

    updated_count = 0
    for asset in manifest.get("assets", []):
        asset_id = asset.get("id")
        if asset_id in lod_map:
            res = lod_map[asset_id]
            asset["lodPath"] = res["lodPath"]
            asset["lodTriangles"] = res["lodTriangles"]
            asset["lodVertices"] = res["lodVertices"]
            asset["lodReductionRatio"] = round(res["reductionPercent"] / 100.0, 3)
            updated_count += 1

    manifest["lodGeneratedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    manifest["totalLods"] = len(lod_results)

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"\nZaktualizowano {updated_count} wpisów LOD w {MANIFEST_PATH}")


def run_lod_generation(output_dir: Path = DEFAULT_OUTPUT_DIR, filter_pattern: list[str] | None = None, ratio: float = 0.35, threshold: int = 350):
    print("==================================================================")
    print("   MARS TERRAFORM — GENERATOR SIATEK LOD VIA BLENDER (DECIMATE)   ")
    print("==================================================================")
    print(f"Katalog docelowy: {output_dir}")
    print(f"Współczynnik redukcji (ratio): {ratio} (~{(1-ratio)*100:.0f}% redukcji)")

    audit = audit_collections()
    sorted_audit = sorted(audit.values(), key=lambda x: x["triangles"], reverse=True)

    print(f"\n--- AUDYT GĘSTOŚCI SIATEK (TOP 20 NAJCIĘŻSZYCH ASSETÓW) ---")
    for idx, item in enumerate(sorted_audit[:20], 1):
        print(f"{idx:2d}. {item['collection']:<32} : {item['triangles']:5d} tris, {item['vertices']:5d} verts ({item['mesh_count']} meshes)")

    # Wyznaczenie listy targetów do generacji LOD
    targets = set(DEFAULT_TARGET_ASSETS)

    # Dodajmy rowniez wszystkie assety przekraczajace threshold
    for item in sorted_audit:
        if item["triangles"] >= threshold:
            targets.add(item["collection"])

    if filter_pattern:
        targets = {t for t in targets if any(f in t for f in filter_pattern)}

    targets_list = sorted(list(targets), key=lambda t: audit.get(t, {}).get("triangles", 0), reverse=True)
    print(f"\nGenerowanie wariantów LOD1 dla {len(targets_list)} modeli:")

    lod_results = []
    for t in targets_list:
        res = generate_lod_for_collection(t, output_dir, ratio=ratio)
        if res:
            lod_results.append(res)

    update_manifest(lod_results)
    print(f"\n=== SUKCES: Wygenerowano {len(lod_results)} siatek LOD1 ===")
    return lod_results


if __name__ == "__main__":
    out_d, filt, rat, thres = parse_args()
    run_lod_generation(out_d, filt, rat, thres)
