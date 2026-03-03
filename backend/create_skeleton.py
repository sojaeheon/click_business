# dir 쉽게 만들기 위한 코드
import os

base_path = r"c:\Users\SSAFY\Documents\GitHub\S14P21B109\backend\src\main\java\com\ssafy\ecosim"

domains = ["user", "company", "inventory", "production", "market", "news"]
domain_subdirs = ["controller", "service", "repository", "entity", "exception"]
dto_subdirs = ["request", "response"]

global_dirs = ["config", "error", "common", "security"]

def create_dir_with_gitkeep(path):
    os.makedirs(path, exist_ok=True)
    gitkeep_path = os.path.join(path, ".gitkeep")
    if not os.path.exists(gitkeep_path):
        with open(gitkeep_path, "w") as f:
            pass

# Create global directories
for g_dir in global_dirs:
    create_dir_with_gitkeep(os.path.join(base_path, "global", g_dir))

# Create domain directories
for domain in domains:
    domain_path = os.path.join(base_path, "domain", domain)
    for sub in domain_subdirs:
        create_dir_with_gitkeep(os.path.join(domain_path, sub))
    
    # DTO subdirectories
    for dto_sub in dto_subdirs:
        create_dir_with_gitkeep(os.path.join(domain_path, "dto", dto_sub))

print("Skeleton directories with .gitkeep created successfully!")

