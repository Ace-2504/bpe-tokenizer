import torch
import torch.nn as nn
from tokenizer import BPETokenizer
import numpy as np


tok = BPETokenizer()
tok.load("vocab.bpe")

vocab_size = len(tok.vocab)
d_model = 64                  
embedding = nn.Embedding(vocab_size, d_model)

mat = embedding.weight.detach().numpy()
ids = tok.encode("hello world")          
ids_tensor = torch.tensor(ids, dtype=torch.long)   
vectors = embedding(ids_tensor)         
print(ids_tensor.shape)   
print(vectors.shape)

torch.set_printoptions(threshold=float("inf"))

np.savetxt("vectors_hello_world.txt", vectors.detach().numpy(), fmt="% .4f", delimiter="  ")

np.savetxt("embedding_matrix.txt", mat, fmt="% .4f", delimiter="  ")
    
# following are commands to load these matrix again
# torch.save(vectors.detach(), "vectors_hello_world.pt") 
# torch.save(embedding.weight.detach(), "embedding_matrix.pt")