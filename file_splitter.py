import os

def file_splitter(file, total_size, parts):
    target_size = total_size/parts
    part = 1
    current_size = 0
    file_name = os.path.basename(file)
    with open(file, "r", encoding="utf-8") as infile:
        out = open(f"part_{part}_{file_name}", "w", encoding="utf-8")
        for line in infile:
            out.write(line)
            current_size += len(line.encode("utf-8"))
            if current_size >= target_size and part<parts:
                out.close()
                part += 1
                current_size = 0
                out = open(f"part_{part}_{file_name}", "w", encoding="utf-8")
        out.close()
        
file_splitter("english_dataset_40mb.txt", 40000000, 4)
             