import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SENHA_ADMIN = 'Admin@123';
const SENHA_DEMO = 'Senha@123';

const CATEGORIAS = ['Pizzas', 'Hambúrgueres', 'Japonesa', 'Massas', 'Sobremesas', 'Bebidas'];

const RESTAURANTES = [
  {
    nome: 'Pizzaria Bella Napoli',
    responsavel: 'Marco Rossi',
    email: 'napoli@demo.com',
    telefone: '(53) 3222-1001',
    endereco: 'Rua Félix da Cunha, 100 - Pelotas/RS',
    descricao: 'Pizzas artesanais de massa fermentada por 48 horas.',
    produtos: [
      { nome: 'Pizza Margherita', descricao: 'Molho de tomate, mussarela de búfala e manjericão.', preco: 49.9, categoria: 'Pizzas', destaque: true },
      { nome: 'Pizza Calabresa', descricao: 'Calabresa fatiada, cebola e azeitonas.', preco: 54.9, categoria: 'Pizzas', destaque: false },
      { nome: 'Fettuccine Alfredo', descricao: 'Massa fresca com creme de leite e parmesão.', preco: 42.0, categoria: 'Massas', destaque: true },
      { nome: 'Tiramisù', descricao: 'Sobremesa italiana com café e mascarpone.', preco: 24.5, categoria: 'Sobremesas', destaque: false },
    ],
  },
  {
    nome: 'Burger do Porto',
    responsavel: 'Ana Souza',
    email: 'burger@demo.com',
    telefone: '(53) 3222-2002',
    endereco: 'Av. Bento Gonçalves, 500 - Pelotas/RS',
    descricao: 'Hambúrgueres artesanais com blend de carne da casa.',
    produtos: [
      { nome: 'Cheeseburger Duplo', descricao: 'Dois burgers de 90g, cheddar, picles e molho especial.', preco: 36.9, categoria: 'Hambúrgueres', destaque: true },
      { nome: 'Burger Bacon Crocante', descricao: 'Burger 150g, bacon crocante e maionese defumada.', preco: 39.9, categoria: 'Hambúrgueres', destaque: false },
      { nome: 'Milkshake de Chocolate', descricao: 'Sorvete de baunilha com calda de chocolate belga.', preco: 19.9, categoria: 'Bebidas', destaque: false },
    ],
  },
  {
    nome: 'Sakura Sushi',
    responsavel: 'Kenji Tanaka',
    email: 'sakura@demo.com',
    telefone: '(53) 3222-3003',
    endereco: 'Rua Marechal Floriano, 250 - Pelotas/RS',
    descricao: 'Culinária japonesa tradicional com peixes frescos.',
    produtos: [
      { nome: 'Combo Sushi 20 peças', descricao: 'Seleção do chef com niguiris, uramakis e hot rolls.', preco: 89.9, categoria: 'Japonesa', destaque: true },
      { nome: 'Temaki de Salmão', descricao: 'Cone de alga com salmão fresco e cream cheese.', preco: 32.0, categoria: 'Japonesa', destaque: false },
      { nome: 'Yakisoba Misto', descricao: 'Macarrão salteado com legumes, frango e carne.', preco: 38.5, categoria: 'Massas', destaque: false },
    ],
  },
];

async function main() {
  const hashAdmin = await bcrypt.hash(SENHA_ADMIN, 10);
  const hashDemo = await bcrypt.hash(SENHA_DEMO, 10);

  await prisma.usuario.upsert({
    where: { email: 'admin@delivery.com' },
    update: {},
    create: { nome: 'Administrador', email: 'admin@delivery.com', senha: hashAdmin, role: 'ADMIN' },
  });

  const cliente = await prisma.usuario.upsert({
    where: { email: 'cliente@demo.com' },
    update: {},
    create: {
      nome: 'Cliente Demo',
      email: 'cliente@demo.com',
      senha: hashDemo,
      telefone: '(53) 99999-0000',
      endereco: 'Rua das Flores, 10 - Pelotas/RS',
      role: 'CLIENTE',
    },
  });

  const categorias = new Map<string, number>();
  for (const nome of CATEGORIAS) {
    const c = await prisma.categoria.upsert({ where: { nome }, update: {}, create: { nome } });
    categorias.set(nome, c.id);
  }

  const produtosCriados: string[] = [];
  let restaurantePrincipal = '';
  for (const r of RESTAURANTES) {
    const { produtos, ...dados } = r;
    const restaurante = await prisma.restaurante.upsert({
      where: { email: dados.email },
      update: {},
      create: { ...dados, senha: hashDemo, status: 'APROVADO', decididoEm: new Date() },
    });
    if (!restaurantePrincipal) restaurantePrincipal = restaurante.id;
    const jaTem = await prisma.produto.count({ where: { restauranteId: restaurante.id } });
    if (jaTem === 0) {
      for (const p of produtos) {
        const criado = await prisma.produto.create({
          data: {
            nome: p.nome,
            descricao: p.descricao,
            preco: p.preco,
            destaque: p.destaque,
            restauranteId: restaurante.id,
            categoriaId: categorias.get(p.categoria) as number,
          },
        });
        produtosCriados.push(criado.id);
      }
    }
  }

  // Uma solicitação pendente para demonstrar o fluxo de aprovação
  await prisma.restaurante.upsert({
    where: { email: 'pendente@demo.com' },
    update: {},
    create: {
      nome: 'Cantina da Nonna',
      responsavel: 'Giulia Bianchi',
      email: 'pendente@demo.com',
      senha: hashDemo,
      telefone: '(53) 3222-4004',
      endereco: 'Rua Gen. Osório, 77 - Pelotas/RS',
      descricao: 'Comida caseira italiana.',
      status: 'PENDENTE',
    },
  });

  // Avaliações, perguntas e pedidos de exemplo (apenas na primeira execução)
  if (produtosCriados.length > 0) {
    const notas = [5, 4, 5, 4, 3, 5];
    for (let i = 0; i < notas.length; i++) {
      const produtoId = produtosCriados[i];
      const outro = await prisma.usuario.upsert({
        where: { email: `avaliador${i}@demo.com` },
        update: {},
        create: { nome: `Avaliador ${i + 1}`, email: `avaliador${i}@demo.com`, senha: hashDemo, role: 'CLIENTE' },
      });
      await prisma.interacao.create({
        data: { tipo: 'AVALIACAO', mensagem: 'Muito bom, chegou quentinho!', nota: notas[i], usuarioId: outro.id, produtoId },
      });
    }
    await prisma.interacao.create({
      data: { tipo: 'PERGUNTA', mensagem: 'Vocês têm opção sem glúten?', usuarioId: cliente.id, produtoId: produtosCriados[0] },
    });

    const itensDisponiveis = await prisma.produto.findMany({ where: { restauranteId: restaurantePrincipal } });
    for (let dia = 0; dia < 10; dia++) {
      const qtdPedidos = (dia % 3) + 1;
      for (let n = 0; n < qtdPedidos; n++) {
        const produto = itensDisponiveis[(dia + n) % itensDisponiveis.length];
        const quantidade = (n % 2) + 1;
        const data = new Date();
        data.setDate(data.getDate() - dia);
        await prisma.pedido.create({
          data: {
            clienteId: cliente.id,
            restauranteId: restaurantePrincipal,
            status: dia === 0 ? 'PENDENTE' : 'ENTREGUE',
            valorTotal: Number(produto.preco) * quantidade,
            enderecoEntrega: 'Rua das Flores, 10 - Pelotas/RS',
            createdAt: data,
            itens: { create: [{ produtoId: produto.id, quantidade, precoUnitario: produto.preco }] },
          },
        });
      }
    }
  }

  console.log('Seed concluído.');
  console.log(`Admin:       admin@delivery.com / ${SENHA_ADMIN}`);
  console.log(`Cliente:     cliente@demo.com / ${SENHA_DEMO}`);
  console.log(`Restaurante: napoli@demo.com / ${SENHA_DEMO}`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
