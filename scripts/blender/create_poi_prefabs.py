"""
scripts/blender/create_poi_prefabs.py

Proceduralny montaż prefabów ruin i baz obcych jako punktów zainteresowania (POI)
w Blenderze via Blender MCP / Blender Python API.

Prefaby:
1. poi_abandoned_lab: 2x structure_closed + corridor + satelliteDish_detailed + barrels
2. poi_alien_hive: rock_crystalsLargeA + rock_crystalsLargeB + bones + Emissive Alien Core
3. poi_crashed_freighter: craterLarge + rocket_baseA (pochylona 25°) + barrels_rail + meteor_half
"""

import sys
import os
import math
import json
from pathlib import Path

import bpy
import mathutils

BLEND_FILE_DEFAULT = r"C:\Users\robert\Documents\mars-terraform.blend"
PROJECT_ROOT = Path(r"C:\Users\robert\code\mars-terraform")
MODELS_OUT_DIR = PROJECT_ROOT / "public" / "models" / "mars"
MANIFEST_PATH = PROJECT_ROOT / "src" / "domain" / "config" / "assetManifest.json"


def ensure_blend_file(filepath=BLEND_FILE_DEFAULT):
    if not bpy.data.filepath or not (os.path.exists(bpy.data.filepath) and os.path.exists(filepath) and os.path.samefile(bpy.data.filepath, filepath)):
        if os.path.exists(filepath):
            print(f"[POI Builder] Opening blend file: {filepath}")
            bpy.ops.wm.open_mainfile(filepath=filepath)
        else:
            print(f"[POI Builder] Using currently open file: {bpy.data.filepath}")


def get_or_create_collection(name: str, parent: bpy.types.Collection | None = None) -> bpy.types.Collection:
    col = bpy.data.collections.get(name)
    if not col:
        col = bpy.data.collections.new(name)
        if parent:
            parent.children.link(col)
        else:
            bpy.context.scene.collection.children.link(col)
    return col


def duplicate_collection_objects(source_col_name: str, target_col: bpy.types.Collection, transform_matrix: mathutils.Matrix = mathutils.Matrix.Identity(4)) -> list[bpy.types.Object]:
    source_col = bpy.data.collections.get(source_col_name)
    if not source_col:
        print(f"[POI Builder] ERROR: Source collection '{source_col_name}' not found!")
        return []

    created_objects = []
    # Collect all mesh objects from the collection
    mesh_objs = [o for o in source_col.all_objects if o.type == 'MESH']

    for src_obj in mesh_objs:
        new_obj = src_obj.copy()
        new_obj.data = src_obj.data.copy()
        target_col.objects.link(new_obj)
        
        # Apply parent matrix and new transform matrix
        new_obj.matrix_world = transform_matrix @ src_obj.matrix_world
        created_objects.append(new_obj)

    return created_objects


def normalize_prefab_collection(col: bpy.types.Collection):
    mesh_objs = [o for o in col.all_objects if o.type == 'MESH']
    if not mesh_objs:
        return

    # Calculate bounding box
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    min_z, max_z = float('inf'), float('-inf')

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

    offset = mathutils.Vector((-center_x, -center_y, -bottom_z))
    for obj in mesh_objs:
        obj.location += offset

    bpy.ops.object.select_all(action='DESELECT')
    for obj in mesh_objs:
        obj.select_set(True)
    if mesh_objs:
        bpy.context.view_layer.objects.active = mesh_objs[0]
        bpy.ops.object.make_single_user(type='SELECTED_OBJECTS', object=True, obdata=True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def calculate_bounds(objects: list[bpy.types.Object]):
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


def export_prefab_glb(col: bpy.types.Collection, glb_path: Path) -> dict:
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    mesh_objs = [o for o in col.all_objects if o.type == 'MESH']
    for obj in mesh_objs:
        obj.select_set(True)

    if mesh_objs:
        bpy.context.view_layer.objects.active = mesh_objs[0]

    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_draco_mesh_compression_enable=False
    )
    print(f"[POI Builder] Exported {col.name} -> {glb_path}")

    dimensions, tris, verts = calculate_bounds(mesh_objs)
    return {
        "id": col.name,
        "category": "05_ENVIRONMENT_DECOR",
        "subCategory": "POI",
        "path": f"/models/mars/{col.name}.glb",
        "fileSize": glb_path.stat().st_size if glb_path.exists() else 0,
        "dimensions": dimensions,
        "triangles": tris,
        "vertices": verts,
    }


def build_abandoned_lab(parent_col: bpy.types.Collection) -> bpy.types.Collection:
    col_name = "poi_abandoned_lab"
    col = get_or_create_collection(col_name, parent=parent_col)
    
    # Clear existing objects in collection
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)

    # 1. Structure 1 (Main Lab)
    mat_struct1 = mathutils.Matrix.Translation((-1.1, 0.0, 0.0))
    duplicate_collection_objects("structure_closed", col, mat_struct1)

    # 2. Corridor connection
    mat_corr = mathutils.Matrix.Translation((0.0, 0.0, 0.0)) @ mathutils.Matrix.Rotation(math.radians(90), 4, 'Z')
    duplicate_collection_objects("corridor", col, mat_corr)

    # 3. Structure 2 (Storage / Annex)
    mat_struct2 = mathutils.Matrix.Translation((1.1, 0.0, 0.0))
    duplicate_collection_objects("structure_closed", col, mat_struct2)

    # 4. Satellite Dish on top of Structure 1 (damaged / tilted)
    mat_dish = (
        mathutils.Matrix.Translation((-1.1, 0.0, 1.0)) @
        mathutils.Matrix.Rotation(math.radians(18), 4, 'Y') @
        mathutils.Matrix.Rotation(math.radians(25), 4, 'Z')
    )
    duplicate_collection_objects("satelliteDish_detailed", col, mat_dish)

    # 5. Scattered Barrels / supplies near Structure 2
    mat_barrels = (
        mathutils.Matrix.Translation((1.6, -0.65, 0.0)) @
        mathutils.Matrix.Rotation(math.radians(35), 4, 'Z')
    )
    duplicate_collection_objects("barrels", col, mat_barrels)

    normalize_prefab_collection(col)
    return col


def build_alien_hive(parent_col: bpy.types.Collection) -> bpy.types.Collection:
    col_name = "poi_alien_hive"
    col = get_or_create_collection(col_name, parent=parent_col)
    
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)

    # 1. Crystals Large A
    mat_crystA = (
        mathutils.Matrix.Translation((-0.35, 0.3, 0.0)) @
        mathutils.Matrix.Rotation(math.radians(25), 4, 'Z') @
        mathutils.Matrix.Scale(1.15, 4)
    )
    duplicate_collection_objects("rock_crystalsLargeA", col, mat_crystA)

    # 2. Crystals Large B
    mat_crystB = (
        mathutils.Matrix.Translation((0.45, -0.25, 0.0)) @
        mathutils.Matrix.Rotation(math.radians(140), 4, 'Z') @
        mathutils.Matrix.Scale(1.1, 4)
    )
    duplicate_collection_objects("rock_crystalsLargeB", col, mat_crystB)

    # 3. Alien bones / debris
    mat_bones = (
        mathutils.Matrix.Translation((0.15, 0.55, 0.0)) @
        mathutils.Matrix.Rotation(math.radians(-50), 4, 'Z') @
        mathutils.Matrix.Scale(1.05, 4)
    )
    duplicate_collection_objects("bones", col, mat_bones)

    # 4. Emissive Alien Core (Procedural Glowing Polyhedron / Core)
    core_mesh = bpy.data.meshes.new("Alien_Core_Mesh")
    core_obj = bpy.data.objects.new("Alien_Core", core_mesh)
    col.objects.link(core_obj)

    # Create an icosphere for the core
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.32)
    bm.to_mesh(core_mesh)
    bm.free()

    core_obj.location = (0.0, 0.0, 0.38)
    core_obj.rotation_euler = (math.radians(15), math.radians(25), math.radians(45))

    # Emissive Material
    mat_name = "M_AlienHive_Core"
    core_mat = bpy.data.materials.get(mat_name)
    if not core_mat:
        core_mat = bpy.data.materials.new(name=mat_name)
        core_mat.use_nodes = True
        nodes = core_mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if bsdf:
            # Vibrant Bioluminescent Neon Cyan/Teal
            bsdf.inputs["Base Color"].default_value = (0.05, 0.85, 0.95, 1.0)
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (0.05, 0.95, 1.0, 1.0)
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = 5.0
            if "Roughness" in bsdf.inputs:
                bsdf.inputs["Roughness"].default_value = 0.2
            if "Metallic" in bsdf.inputs:
                bsdf.inputs["Metallic"].default_value = 0.1

    core_obj.data.materials.append(core_mat)

    normalize_prefab_collection(col)
    return col


def build_crashed_freighter(parent_col: bpy.types.Collection) -> bpy.types.Collection:
    col_name = "poi_crashed_freighter"
    col = get_or_create_collection(col_name, parent=parent_col)
    
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)

    # 1. Large Impact Crater
    mat_crater = (
        mathutils.Matrix.Translation((0.0, 0.0, -0.05)) @
        mathutils.Matrix.Scale(2.3, 4, (1, 0, 0)) @
        mathutils.Matrix.Scale(2.3, 4, (0, 1, 0)) @
        mathutils.Matrix.Scale(1.2, 4, (0, 0, 1))
    )
    duplicate_collection_objects("craterLarge", col, mat_crater)

    # 2. Crashed Rocket Fuselage (Tilted 25 degrees into crater)
    mat_rocket = (
        mathutils.Matrix.Translation((-0.2, 0.0, 0.15)) @
        mathutils.Matrix.Rotation(math.radians(-30), 4, 'Z') @
        mathutils.Matrix.Rotation(math.radians(25), 4, 'X') @
        mathutils.Matrix.Rotation(math.radians(10), 4, 'Y') @
        mathutils.Matrix.Scale(1.1, 4)
    )
    duplicate_collection_objects("rocket_baseA", col, mat_rocket)

    # 3. Barrels / cargo debris scattered
    mat_cargo = (
        mathutils.Matrix.Translation((1.2, 0.6, 0.02)) @
        mathutils.Matrix.Rotation(math.radians(40), 4, 'Z')
    )
    duplicate_collection_objects("barrels_rail", col, mat_cargo)

    # 4. Meteor / debris half
    mat_meteor = (
        mathutils.Matrix.Translation((-1.0, -0.7, 0.0)) @
        mathutils.Matrix.Rotation(math.radians(-65), 4, 'Z') @
        mathutils.Matrix.Scale(1.2, 4)
    )
    duplicate_collection_objects("meteor_half", col, mat_meteor)

    normalize_prefab_collection(col)
    return col


def main():
    print("=== STARTING POI PREFAB GENERATION ===")
    ensure_blend_file()

    env_decor_col = get_or_create_collection("05_ENVIRONMENT_DECOR")
    poi_col = get_or_create_collection("POI", parent=env_decor_col)

    lab_col = build_abandoned_lab(poi_col)
    hive_col = build_alien_hive(poi_col)
    freighter_col = build_crashed_freighter(poi_col)

    prefabs = [lab_col, hive_col, freighter_col]
    manifest_updates = []

    for p_col in prefabs:
        out_glb = MODELS_OUT_DIR / f"{p_col.name}.glb"
        meta = export_prefab_glb(p_col, out_glb)
        manifest_updates.append(meta)

    # Update assetManifest.json
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest_data = json.load(f)
    else:
        manifest_data = {"version": "1.0", "assets": []}

    existing_ids = {a["id"]: idx for idx, a in enumerate(manifest_data.get("assets", []))}
    for new_entry in manifest_updates:
        if new_entry["id"] in existing_ids:
            manifest_data["assets"][existing_ids[new_entry["id"]]] = new_entry
        else:
            manifest_data["assets"].append(new_entry)

    manifest_data["totalAssets"] = len(manifest_data["assets"])
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2, ensure_ascii=False)
    print(f"[POI Builder] Updated assetManifest.json with {len(manifest_updates)} POI prefabs.")

    # Save .blend mainfile
    if bpy.data.filepath:
        bpy.ops.wm.save_mainfile()
        print(f"[POI Builder] Saved Blender library to {bpy.data.filepath}")

    print("=== POI PREFAB GENERATION COMPLETED ===")


if __name__ == "__main__":
    main()
