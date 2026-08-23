"""
Automated 3D Icon Renderer for Mars Terraform via Blender MCP / Blender Python API.
Renders all buildings and units from mars-terraform.blend into 128x128 transparent WebP icons.
"""

import os
import sys
import math
import shutil
import mathutils
import bpy

BLEND_FILE_DEFAULT = r"C:\Users\robert\Documents\mars-terraform.blend"
PROJECT_ROOT = os.path.abspath(r"C:\Users\robert\code\mars-terraform")
BUILDINGS_OUT_DIR = os.path.join(PROJECT_ROOT, "public", "icons", "buildings")
UNITS_OUT_DIR = os.path.join(PROJECT_ROOT, "public", "icons", "units")
POI_OUT_DIR = os.path.join(PROJECT_ROOT, "public", "icons", "poi")

POI_MODELS = [
    "poi_abandoned_lab",
    "poi_alien_hive",
    "poi_crashed_freighter",
]

# Mapping from game Building/Unit IDs to blend model names
BUILDING_ID_MAP = {
    "hab": "rocket_baseA",
    "greenhouse": "hangar_roundGlass",
    "o2-gen": "machine_generator",
    "solar": "machine_generator",
    "rtg": "machine_generatorLarge",
    "ice": "pipe_entrance",
    "miner": "craft_miner",
    "battery": "machine_wireless",
    "watertank": "machine_barrel",
    "silo": "machine_barrelLarge",
    "lab": "machine_wireless",
    "turret": "turret_single",
}

UNIT_ID_MAP = {
    "rover": "rover",
    "drone": "craft_speederA",
    "rover_combat": "rover_combat",
    "drone_repair": "drone_repair",
    "craft_hauler": "craft_hauler",
}


def ensure_blend_file(filepath=BLEND_FILE_DEFAULT):
    if not bpy.data.filepath or not (os.path.exists(bpy.data.filepath) and os.path.exists(filepath) and os.path.samefile(bpy.data.filepath, filepath)):
        if os.path.exists(filepath):
            print(f"[Renderer] Opening blend file: {filepath}")
            bpy.ops.wm.open_mainfile(filepath=filepath)
        else:
            print(f"[Renderer] Using currently open file: {bpy.data.filepath}")


def ensure_studio_environment():
    scene = bpy.context.scene
    
    # 1. Output settings
    scene.render.resolution_x = 128
    scene.render.resolution_y = 128
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 95
    scene.render.image_settings.color_mode = 'RGBA'

    # 2. Studio collection
    col = bpy.data.collections.get("00_STUDIO_ENV")
    if not col:
        col = bpy.data.collections.new("00_STUDIO_ENV")
        scene.collection.children.link(col)
    col.hide_render = False

    # 3. Studio Camera
    cam_obj = bpy.data.objects.get("Studio_Camera")
    if not cam_obj:
        cam_data = bpy.data.cameras.new(name="Studio_Camera")
        cam_obj = bpy.data.objects.new("Studio_Camera", cam_data)
        col.objects.link(cam_obj)
    
    cam_obj.data.type = 'ORTHO'
    scene.camera = cam_obj

    # 4. Studio 3-Point Lighting
    def setup_light(name, light_type, energy, color, rot_deg):
        obj = bpy.data.objects.get(name)
        if not obj:
            l_data = bpy.data.lights.new(name=name, type=light_type)
            obj = bpy.data.objects.new(name=name, object_data=l_data)
            col.objects.link(obj)
        else:
            l_data = obj.data
        l_data.type = light_type
        l_data.energy = energy
        l_data.color = color
        obj.rotation_euler = (math.radians(rot_deg[0]), math.radians(rot_deg[1]), math.radians(rot_deg[2]))
        return obj

    # Key light: Front-top-left (warm)
    setup_light("Studio_KeyLight", 'SUN', 3.2, (1.0, 0.96, 0.90), (50, 10, 35))
    # Fill light: Front-right (cool soft)
    setup_light("Studio_FillLight", 'SUN', 1.4, (0.75, 0.88, 1.0), (60, -25, -50))
    # Rim light: Back-high (edge highlight)
    setup_light("Studio_RimLight", 'SUN', 2.2, (0.92, 0.95, 1.0), (-55, 20, -140))

    return cam_obj


def get_ancestors(target_col):
    ancestors = set()
    def find_parent(curr_col):
        for c in bpy.data.collections:
            if curr_col.name in [ch.name for ch in c.children]:
                ancestors.add(c.name)
                find_parent(c)
    find_parent(target_col)
    return ancestors


def isolate_collection(target_col_name):
    target_col = bpy.data.collections.get(target_col_name)
    if not target_col:
        return False
    ancestors = get_ancestors(target_col)

    for col in bpy.data.collections:
        if col.name == '00_STUDIO_ENV' or col.name == target_col_name or col.name in ancestors:
            col.hide_render = False
        else:
            col.hide_render = True

    for col_name in ancestors:
        parent_col = bpy.data.collections.get(col_name)
        if parent_col:
            for child in parent_col.children:
                if child.name != target_col_name and child.name not in ancestors:
                    child.hide_render = True
    return True


def render_collection(target_col_name, output_path, cam_obj):
    target_col = bpy.data.collections.get(target_col_name)
    if not target_col:
        print(f"[Renderer] Skipping: collection '{target_col_name}' not found.")
        return False

    mesh_objs = [o for o in target_col.all_objects if o.type == 'MESH']
    if not mesh_objs:
        print(f"[Renderer] Skipping: no mesh objects in '{target_col_name}'.")
        return False

    isolate_collection(target_col_name)

    # Calculate bounding box
    corners = []
    for obj in mesh_objs:
        for corner in obj.bound_box:
            corners.append(obj.matrix_world @ mathutils.Vector(corner))

    min_co = mathutils.Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    max_co = mathutils.Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    center = (min_co + max_co) / 2.0

    # 45 deg isometric camera orientation: (60 deg X, 0 Y, 45 deg Z)
    cam_obj.rotation_euler = (math.radians(60), 0, math.radians(45))
    rot_mat = cam_obj.rotation_euler.to_matrix()
    forward = rot_mat @ mathutils.Vector((0, 0, -1))
    cam_obj.location = center - forward * 30.0

    bpy.context.view_layer.update()
    cam_mat_inv = cam_obj.matrix_world.inverted()
    cam_corners = [cam_mat_inv @ c for c in corners]
    min_x = min(c.x for c in cam_corners)
    max_x = max(c.x for c in cam_corners)
    min_y = min(c.y for c in cam_corners)
    max_y = max(c.y for c in cam_corners)
    view_w = max_x - min_x
    view_h = max_y - min_y
    cam_obj.data.ortho_scale = max(view_w, view_h) * 1.25

    shift_x = (min_x + max_x) / 2.0
    shift_y = (min_y + max_y) / 2.0
    cam_obj.location += rot_mat @ mathutils.Vector((shift_x, shift_y, 0))
    bpy.context.view_layer.update()

    # Render
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    print(f"[Renderer] Rendered: {target_col_name} -> {output_path}")
    return True


def get_leaf_models(top_col_name):
    top_col = bpy.data.collections.get(top_col_name)
    if not top_col:
        return []
    leaves = []
    def traverse(c):
        if not c.children:
            if any(o.type == 'MESH' for o in c.all_objects):
                leaves.append(c.name)
        else:
            for child in c.children:
                traverse(child)
    traverse(top_col)
    return leaves


def main():
    print("=== STARTING 3D ICON RENDERING ===")
    ensure_blend_file()
    cam_obj = ensure_studio_environment()

    os.makedirs(BUILDINGS_OUT_DIR, exist_ok=True)
    os.makedirs(UNITS_OUT_DIR, exist_ok=True)

    # 1. Collect building models from 01_BUILDINGS + Communications (machine_wireless)
    building_models = get_leaf_models("01_BUILDINGS")
    if "machine_wireless" not in building_models and bpy.data.collections.get("machine_wireless"):
        building_models.append("machine_wireless")

    print(f"[Renderer] Found {len(building_models)} building models to render.")
    for model_name in building_models:
        out_path = os.path.join(BUILDINGS_OUT_DIR, f"{model_name}.webp")
        render_collection(model_name, out_path, cam_obj)

    # 2. Collect unit models from 02_UNITS_LOGISTICS
    unit_models = get_leaf_models("02_UNITS_LOGISTICS")
    print(f"[Renderer] Found {len(unit_models)} unit models to render.")
    for model_name in unit_models:
        out_path = os.path.join(UNITS_OUT_DIR, f"{model_name}.webp")
        render_collection(model_name, out_path, cam_obj)

    # 3. Create ID aliases for building IDs (e.g. hab.webp -> rocket_baseA.webp)
    print("[Renderer] Creating building ID aliases...")
    for b_id, model_name in BUILDING_ID_MAP.items():
        src_path = os.path.join(BUILDINGS_OUT_DIR, f"{model_name}.webp")
        if not os.path.exists(src_path):
            unit_src = os.path.join(UNITS_OUT_DIR, f"{model_name}.webp")
            if os.path.exists(unit_src):
                src_path = unit_src
        dst_path = os.path.join(BUILDINGS_OUT_DIR, f"{b_id}.webp")
        if os.path.exists(src_path) and src_path != dst_path:
            shutil.copy2(src_path, dst_path)
            print(f"[Renderer] Alias: {b_id}.webp <= {model_name}.webp")

    # 4. Create ID aliases for unit IDs (e.g. drone.webp -> craft_speederA.webp)
    print("[Renderer] Creating unit ID aliases...")
    for u_id, model_name in UNIT_ID_MAP.items():
        src_path = os.path.join(UNITS_OUT_DIR, f"{model_name}.webp")
        dst_path = os.path.join(UNITS_OUT_DIR, f"{u_id}.webp")
        if os.path.exists(src_path) and src_path != dst_path:
            shutil.copy2(src_path, dst_path)
            print(f"[Renderer] Alias: {u_id}.webp <= {model_name}.webp")

    # 5. Render POI icons
    os.makedirs(POI_OUT_DIR, exist_ok=True)
    print(f"[Renderer] Rendering {len(POI_MODELS)} POI models...")
    for model_name in POI_MODELS:
        poi_path = os.path.join(POI_OUT_DIR, f"{model_name}.webp")
        rendered = render_collection(model_name, poi_path, cam_obj)
        if rendered:
            bld_path = os.path.join(BUILDINGS_OUT_DIR, f"{model_name}.webp")
            shutil.copy2(poi_path, bld_path)
            print(f"[Renderer] POI Icon saved: {poi_path} & {bld_path}")

    print("=== ICON RENDERING COMPLETED SUCCESSFULLY ===")


if __name__ == "__main__":
    main()
