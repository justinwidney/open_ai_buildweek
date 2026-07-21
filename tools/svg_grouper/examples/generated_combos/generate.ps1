$py = "C:\Users\winde\anaconda3\python.exe"
$dbg = "c:\Users\winde\Downloads\build_week\open_ai_buildweek\tools\svg_grouper\debug"
$chunks = "c:\Users\winde\Downloads\build_week\open_ai_buildweek\tools\svg_grouper\examples\reference_06_03\chunks"
$out = "c:\Users\winde\Downloads\build_week\open_ai_buildweek\tools\svg_grouper\examples\generated_combos"
New-Item -ItemType Directory -Force $out | Out-Null

# 1 classic: castle high, road down, meadow + islands flanking
& $py "$dbg\compose_chain.py" $chunks "$out\combo_classic.svg" chunk_04_castle_road chunk_00_platform_road --jitter 35 --seed 3 --at chunk_02_platform:-60,620 --at chunk_03_island:980,180 --at chunk_16_island:60,120 --at chunk_21_cloud:180,60 --at chunk_22_cloud:860,420 --at chunk_19_cloud:-40,360

# 2 mirrored feel: islands left, jitter opposite
& $py "$dbg\compose_chain.py" $chunks "$out\combo_westward.svg" chunk_04_castle_road chunk_00_platform_road --jitter 45 --seed 11 --at chunk_18_island:40,110 --at chunk_09_platform:60,430 --at chunk_11_platform:950,120 --at chunk_23_cloud:640,40 --at chunk_25_cloud:900,560

# 3 long road: road chunk repeated for a taller scene
& $py "$dbg\compose_chain.py" $chunks "$out\combo_longroad.svg" chunk_04_castle_road chunk_00_platform_road chunk_00_platform_road --jitter 55 --seed 21 --at chunk_16_island:900,150 --at chunk_24_island:120,240 --at chunk_21_cloud:150,700 --at chunk_22_cloud:840,950

# 4 minimal: castle + road + one island + clouds
& $py "$dbg\compose_chain.py" $chunks "$out\combo_minimal.svg" chunk_04_castle_road chunk_00_platform_road --jitter 20 --seed 5 --at chunk_03_island:-140,320 --at chunk_23_cloud:520,40

# 5 archipelago: no chain logic, scattered platforms around a floating castle
& $py "$dbg\compose_chain.py" $chunks "$out\combo_archipelago.svg" chunk_04_castle_road --at chunk_08_platform:80,340 --at chunk_11_platform:300,520 --at chunk_13_platform:850,380 --at chunk_14_platform:1020,180 --at chunk_16_island:60,100 --at chunk_18_island:1050,540 --at chunk_09_platform:560,600 --at chunk_21_cloud:250,240 --at chunk_22_cloud:900,80 --at chunk_19_cloud:640,420

# 6 dense valley: everything crowding the road
& $py "$dbg\compose_chain.py" $chunks "$out\combo_dense.svg" chunk_04_castle_road chunk_00_platform_road --jitter 50 --seed 33 --at chunk_02_platform:-80,600 --at chunk_05_platform:-20,180 --at chunk_07_platform:920,90 --at chunk_10_platform:930,420 --at chunk_12_platform:40,60 --at chunk_15_platform:900,600 --at chunk_20_platform:1010,300 --at chunk_17_cloud:340,30 --at chunk_25_cloud:700,660

Set-Location $dbg
node -e @'
const s = require("sharp");
const dir = "c:/Users/winde/Downloads/build_week/open_ai_buildweek/tools/svg_grouper/examples/generated_combos/";
const names = ["combo_classic","combo_westward","combo_longroad","combo_minimal","combo_archipelago","combo_dense"];
Promise.all(names.map(n => s(dir+n+".svg").png().toFile(dir+n+".png"))).then(()=>console.log("rendered", names.length));
'@
