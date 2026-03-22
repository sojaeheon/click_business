import re

def fix_ranking():
    file_path = r"c:\Users\SSAFY\Desktop\S14P21B109\frontend\src\app\components\modals\RankingModal.tsx"
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Remove <th ...>티어</th>
    text = re.sub(r'<th[^>]*>\s*티어\s*</th>', '', text)
    # Remove <td ...>{entry.company}</td>
    text = re.sub(r'<td[^>]*>\{\s*entry\.company\s*\}</td>', '', text)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("RankingModal.tsx fixed!")

def fix_api():
    api_path = r"c:\Users\SSAFY\Desktop\S14P21B109\frontend\src\api\gameApi.ts"
    with open(api_path, 'r', encoding='utf-8') as f:
        api_text = f.read()

    # Remove , tier: "..." from API mock
    api_text = re.sub(r',\s*tier:\s*"[^"]*"', '', api_text)

    with open(api_path, 'w', encoding='utf-8') as f:
        f.write(api_text)
    print("gameApi.ts fixed!")

fix_ranking()
fix_api()
