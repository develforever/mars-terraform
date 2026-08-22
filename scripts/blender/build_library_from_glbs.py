"""
scripts/blender/build_library_from_glbs.py

Skrypt budujący centralny plik biblioteki Blender (.blend) ze wszystkich modeli GLB
znajdujących się w public/models/mars/.

Uruchomienie (headless):
  & 'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe' -b -P scripts/blender/build_library_from_glbs.py

Opcjonalny argument --blend-path:
  & 'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe' -b -P scripts/blender/build_library_from_glbs.py -- --blend-path="C:\\Users\\robert\\Documents\\mars-terraform.blend"
"""

import sys
import os
import math
from pathlib import Path

try:
    import bpy
    import mathutils
except ImportError:
    print("ERROR: Ten skrypt musi być uruchomiony wewnątrz Blendera: blender.exe -b -P <skrypt>")
    sys.exit(1)


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
MODELS_DIR = WORKSPACE_ROOT / "public" / "models" / "mars"
DEFAULT_TARGET_BLEND = Path(os.environ.get("MARS_BLEND_LIBRARY_PATH", "C:/Users/robert/Documents/mars-terraform.blend"))


def parse_args():
    target_path = DEFAULT_TARGET_BLEND
    if "--" in sys.argv:
        idx = sys.argv.index("--")
        for arg in sys.argv[idx + 1:]:
            if arg.startswith("--blend-path="):
                target_path = Path(arg.split("=", 1)[1].strip('"\''))
            elif arg.startswith("--models-dir="):
                global MODELS_DIR
                MODELS_DIR = Path(arg.split("=", 1)[1].strip('"\''))
    return target_path


CATEGORY_RULES = [
    # (MainCat, SubCat, Prefixes/Matches)
    ("01_BUILDINGS", "Habitation", ["rocket_base", "hangar_", "structure_"]),
    ("01_BUILDINGS", "Production", ["machine_generator", "pipe_entrance"]),
    ("01_BUILDINGS", "Storage", ["machine_barrel", "silo", "barrel"]),
    ("01_BUILDINGS", "Defense", ["turret_"]),

    ("02_UNITS_LOGISTICS", "Ground", ["rover", "monorail_train"]),
    ("02_UNITS_LOGISTICS", "Air", ["craft_miner", "craft_cargo", "craft_speeder", "craft_racer"]),

    ("03_MODULAR_BASE", "Corridors", ["corridor"]),
    ("03_MODULAR_BASE", "Platforms", ["platform_"]),
    ("03_MODULAR_BASE", "Monorail_Tracks", ["monorail_track"]),
    ("03_MODULAR_BASE", "Stairs_Gates", ["stairs_", "gate_", "supports_", "chimney_", "rail"]),

    ("04_INFRASTRUCTURE", "Pipes", ["pipe_"]),
    ("04_INFRASTRUCTURE", "Communications", ["satelliteDish", "machine_wireless"]),
    ("04_INFRASTRUCTURE", "Energy_Rockets", ["rocket_"]),

    ("05_ENVIRONMENT_DECOR", "Rocks_Crystals", ["rock", "rocks", "meteor"]),
    ("05_ENVIRONMENT_DECOR", "Craters", ["crater"]),
    ("05_ENVIRONMENT_DECOR", "Terrains_Legacy", ["terrain"]),

    ("06_PROPS_INTERIOR", "Furniture", ["desk_"]),
    ("06_PROPS_INTERIOR", "Weapons", ["weapon_"]),
    ("06_PROPS_INTERIOR", "Characters_Misc", ["alien", "astronaut", "bones"]),
]


def categorize_model(model_name: str) -> tuple[str, str]:
    for main_cat, sub_cat, prefixes in CATEGORY_RULES:
        for p in prefixes:
            if model_name.startswith(p) or (p in model_name):
                return main_cat, sub_cat
    return "06_PROPS_INTERIOR", "Misc"


def reset_blend_scene():
    """Czyszczenie poczatkowego stanu sceny Blendera"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)


def get_or_create_collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    col = bpy.data.collections.get(name)
    if not col:
        col = bpy.data.collections.new(name)
        if parent:
            parent.children.link(col)
        else:
            bpy.context.scene.collection.children.link(col)
    return col


def setup_studio_lighting():
    """Tworzy kolekcje 00_STUDIO_ENV z neutralnym oswietleniem i kamera"""
    env_col = get_or_create_collection("00_STUDIO_ENV")
    env_col.hide_render = False

    # Key light
    key_light_data = bpy.data.lights.new(name="Studio_KeyLight", type='SUN')
    key_light_data.energy = 2.5
    key_light_data.color = (1.0, 0.95, 0.9)
    key_light_obj = bpy.data.objects.new(name="Studio_KeyLight", object_data=key_light_data)
    key_light_obj.location = (10, -10, 20)
    key_light_obj.rotation_euler = (math.radians(45), math.radians(15), math.radians(45))
    env_col.objects.link(key_light_obj)

    # Fill light
    fill_light_data = bpy.data.lights.new(name="Studio_FillLight", type='SUN')
    fill_light_data.energy = 1.0
    fill_light_data.color = (0.7, 0.8, 1.0)
    fill_light_obj = bpy.data.objects.new(name="Studio_FillLight", object_data=fill_light_data)
    fill_light_obj.location = (-10, 10, 15)
    fill_light_obj.rotation_euler = (math.radians(60), math.radians(-30), math.radians(-120))
    env_col.objects.link(fill_light_obj)

    # Studio Camera
    cam_data = bpy.data.cameras.new(name="Studio_Camera")
    cam_obj = bpy.data.objects.new(name="Studio_Camera", object_data=cam_data)
    cam_obj.location = (25, -25, 20)
    cam_obj.rotation_euler = (math.radians(60), 0, math.radians(45))
    env_col.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj


def normalize_imported_objects(objects: list[bpy.types.Object]):
    """
    Normalizuje pozycje zaimportowanych obiektow:
    - Min-Z obiektu trafia na Z=0 (Base Pivot)
    - Srodek bounding boxa (X, Y) trafia na (0,0)
    - Aplikuje transformacje
    """
    if not objects:
        return

    # Oblicz calkowity bounding box w ukladzie lokalnym
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    min_z, max_z = float('inf'), float('-inf')

    mesh_objs = [o for o in objects if o.type == 'MESH']
    if not mesh_objs:
        return

    for obj in mesh_objs:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ mathutils.Vector(corner)
            min_x = min(min_x, world_corner.x)
            max_x = max(max_x, world_corner.x)
            min_y = min(min_y, world_corner.y)
            max_y = max(max_y, world_corner.y)
            min_z = min(min_z, world_corner.z)
            max_z = max(max_z, world_corner.z)

    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    bottom_z = min_z

    # Przesun kazdy obiekt o offset
    offset = mathutils.Vector((-center_x, -center_y, -bottom_z))
    for obj in objects:
        obj.location += offset

    # Aplikacja transformacji: najpierw make single-user dla wspoldzielonych mesh-datablokow
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    # Rozlaczenie multi-user mesh data jesli wystepuje
    bpy.ops.object.make_single_user(type='SELECTED_OBJECTS', object=True, obdata=True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def build_library(target_blend_path: Path):
    print(f"=== ROZPOCZYNAM BUDOWĘ BIBLIOTEKI BLENDERA ===")
    print(f"Katalog źródłowy GLB: {MODELS_DIR}")
    print(f"Plik docelowy:        {target_blend_path}")

    if not MODELS_DIR.exists():
        print(f"ERROR: Katalog {MODELS_DIR} nie istnieje!")
        sys.exit(1)

    glb_files = sorted(list(MODELS_DIR.glob("*.glb")))
    print(f"Znaleziono {len(glb_files)} plików .glb do zaimportowania.")

    reset_blend_scene()
    setup_studio_lighting()

    main_cat_cols: dict[str, bpy.types.Collection] = {}
    sub_cat_cols: dict[str, bpy.types.Collection] = {}
    asset_cols: list[tuple[str, bpy.types.Collection]] = []

    # Kolekcja showcase dla podglądu w widoku 3D
    showcase_col = get_or_create_collection("99_STUDIO_SHOWCASE")

    imported_count = 0

    for glb_file in glb_files:
        asset_name = glb_file.stem
        main_cat, sub_cat = categorize_model(asset_name)

        if main_cat not in main_cat_cols:
            main_cat_cols[main_cat] = get_or_create_collection(main_cat)

        sub_key = f"{main_cat}/{sub_cat}"
        if sub_key not in sub_cat_cols:
            sub_cat_cols[sub_key] = get_or_create_collection(sub_cat, parent=main_cat_cols[main_cat])

        # Dedykowana podkolekcja dla konkretnego assetu
        asset_col = bpy.data.collections.new(asset_name)
        sub_cat_cols[sub_key].children.link(asset_col)

        # Import GLB
        existing_objects = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(glb_file))
        new_objects = [o for o in bpy.data.objects if o not in existing_objects]

        # Przeniesienie do kolekcji assetu
        for obj in new_objects:
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            asset_col.objects.link(obj)

        # Normalizacja geometrii (base pivot)
        normalize_imported_objects(new_objects)

        # Oznaczenie kolekcji jako Asset w Blenderze (Blender 3.0+)
        try:
            asset_col.asset_mark()
        except Exception:
            pass

        asset_cols.append((asset_name, asset_col))
        imported_count += 1

    print(f"Pomyślnie zaimportowano i zorganizowano {imported_count} assetów.")

    # Budowa siatki podgladowej (Showcase Grid) w kolekcji 99_STUDIO_SHOWCASE
    # Obiekty sa rozstawiane jako Empty Collection Instances (odstęp 5.0m)
    print("Tworzenie siatki podglądowej w kolekcji 99_STUDIO_SHOWCASE...")
    GRID_SPACING = 5.0
    GRID_COLS = 14

    for idx, (name, col) in enumerate(asset_cols):
        grid_x = (idx % GRID_COLS) * GRID_SPACING
        grid_y = (idx // GRID_COLS) * GRID_SPACING

        instance_empty = bpy.data.objects.new(f"Showcase_{name}", None)
        instance_empty.empty_display_type = 'PLAIN_AXES'
        instance_empty.instance_type = 'COLLECTION'
        instance_empty.instance_collection = col
        instance_empty.location = (grid_x, grid_y, 0)
        showcase_col.objects.link(instance_empty)

    # Zapewnij katalog nadrzędny
    target_blend_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Zapisywanie pliku biblioteki do: {target_blend_path} ...")
    bpy.ops.wm.save_as_mainfile(filepath=str(target_blend_path))
    print("=== BUDOWA BIBLIOTEKI ZAKOŃCZONA SUKCESEM ===")


if __name__ == "__main__":
    target_path = parse_args()
    build_library(target_path)
