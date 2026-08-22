"""
scripts/blender/export_all_assets.py

Skrypt do automatycznego batch-eksportu modeli GLB z centralnego pliku biblioteki .blend.

Uruchomienie (headless):
  & 'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe' -b 'C:\\Users\\robert\\Documents\\mars-terraform.blend' -P scripts/blender/export_all_assets.py

Opcjonalne argumenty:
  --output-dir="public/models/mars"
  --filter="rover,craft_miner"
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


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = WORKSPACE_ROOT / "public" / "models" / "mars"
MANIFEST_PATH = WORKSPACE_ROOT / "src" / "domain" / "config" / "assetManifest.json"


def parse_args():
    output_dir = DEFAULT_OUTPUT_DIR
    filter_pattern = None

    if "--" in sys.argv:
        idx = sys.argv.index("--")
        for arg in sys.argv[idx + 1:]:
            if arg.startswith("--output-dir="):
                output_dir = Path(arg.split("=", 1)[1].strip('"\''))
            elif arg.startswith("--filter="):
                filter_pattern = [p.strip() for p in arg.split("=", 1)[1].strip('"\'').split(",")]

    return output_dir, filter_pattern


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
    # Musi zawierac co najmniej jeden obiekt siatki lub empty
    return len(col.objects) > 0


def find_parent_category(col: bpy.types.Collection) -> tuple[str, str]:
    """Wyszukuje kategorie nadrzedna dla kolekcji assetu"""
    for main_col in bpy.data.collections:
        if col.name in main_col.children:
            return main_col.name, "General"
        for sub_col in main_col.children:
            if col.name in sub_col.children:
                return main_col.name, sub_col.name
    return "Misc", "Misc"


def calculate_collection_bounds(objects: list[bpy.types.Object]):
    """Oblicza wymiary i liczbe wielokatow dla kolekcji"""
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    min_z, max_z = float('inf'), float('-inf')
    total_tris = 0
    total_verts = 0

    mesh_objs = [o for o in objects if o.type == 'MESH']
    for obj in mesh_objs:
        total_verts += len(obj.data.vertices)
        total_tris += len(obj.data.polygons)
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ mathutils.Vector(corner)
            min_x = min(min_x, world_corner.x)
            max_x = max(max_x, world_corner.x)
            min_y = min(min_y, world_corner.y)
            max_y = max(max_y, world_corner.y)
            min_z = min(min_z, world_corner.z)
            max_z = max(max_z, world_corner.z)

    if not mesh_objs:
        return {"x": 0.0, "y": 0.0, "z": 0.0}, 0, 0

    size_x = round(max_x - min_x, 3)
    size_y = round(max_y - min_y, 3)
    size_z = round(max_z - min_z, 3)
    return {"x": size_x, "y": size_y, "z": size_z}, total_tris, total_verts


def export_assets(output_dir: Path, filter_pattern: list[str] | None):
    print("=== ROZPOCZYNAM BATCH EKSPORT ASSETÓW GLB ===")
    print(f"Katalog docelowy: {output_dir}")
    if filter_pattern:
        print(f"Filtr: {filter_pattern}")

    output_dir.mkdir(parents=True, exist_ok=True)

    asset_collections = [c for c in bpy.data.collections if is_asset_collection(c)]
    print(f"Znaleziono {len(asset_collections)} kolekcji assetów.")

    manifest_entries = []
    exported_count = 0

    for col in sorted(asset_collections, key=lambda c: c.name):
        asset_name = col.name

        if filter_pattern:
            if not any(f in asset_name for f in filter_pattern):
                continue

        # Zaznacz tylko obiekty tej kolekcji
        bpy.ops.object.select_all(action='DESELECT')
        mesh_count = 0
        for obj in col.objects:
            obj.select_set(True)
            if obj.type == 'MESH':
                mesh_count += 1

        if mesh_count == 0:
            continue

        bpy.context.view_layer.objects.active = col.objects[0]

        dimensions, tris, verts = calculate_collection_bounds(list(col.objects))
        main_cat, sub_cat = find_parent_category(col)

        out_file = output_dir / f"{asset_name}.glb"

        # Eksport GLB glTF 2.0
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

        manifest_entries.append({
            "id": asset_name,
            "category": main_cat,
            "subCategory": sub_cat,
            "path": f"/models/mars/{asset_name}.glb",
            "fileSize": out_file.stat().st_size if out_file.exists() else 0,
            "dimensions": dimensions,
            "triangles": tris,
            "vertices": verts,
        })
        exported_count += 1

    # Generowanie manifestu JSON
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    manifest_data = {
        "version": "1.0",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "totalAssets": len(manifest_entries),
        "assets": manifest_entries
    }

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2, ensure_ascii=False)

    print(f"Pomyślnie wyeksportowano {exported_count} modeli .glb.")
    print(f"Zapisano manifest do: {MANIFEST_PATH}")
    print("=== EKSPORT ZAKOŃCZONY SUKCESEM ===")


if __name__ == "__main__":
    out_dir, filt = parse_args()
    export_assets(out_dir, filt)
