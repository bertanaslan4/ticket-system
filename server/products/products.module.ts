import { Module, Controller, Get, Post, Body, Param, Req, HttpCode, UseGuards, Injectable } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { DatabaseService } from '../database/database.service.js';
import { str, integer, audit } from '../common/admin-domain.js';
import { fail } from '../common/domain.js';

@Injectable()
export class ProductsService {
  constructor(private readonly db: DatabaseService) {}
  async list() {
    return (await this.db.query('SELECT p.*,(SELECT count(*)::int FROM organizations o WHERE o.product_id=p.id) customer_count,(SELECT count(*)::int FROM tickets t WHERE t.product_id=p.id) ticket_count FROM products p ORDER BY p.name,p.id')).rows;
  }
  async save(id: string | undefined, body: any, user: any) {
    const name = str(body.name), productId = id ? integer(id) : null;
    try {
      return await this.db.transaction(async tx => {
        const result = productId
          ? await tx.query('UPDATE products SET name=$1 WHERE id=$2 RETURNING *',[name,productId])
          : await tx.query('INSERT INTO products(name) VALUES($1) RETURNING *',[name]);
        const row = result.rows[0];
        if (!row) fail(404,'product_not_found');
        // Company defaults follow the current name; ticket text remains a snapshot.
        if (productId) await tx.query('UPDATE organizations SET program=$1 WHERE product_id=$2',[name,productId]);
        await audit(tx,user,productId ? 'product_updated' : 'product_created',row.id,{name});
        return row;
      });
    } catch(error) {
      if (error.code === '23505') fail(409,'product_name_in_use');
      throw error;
    }
  }
}
@Controller('admin/products')
@UseGuards(AdminGuard)
class ProductsController {
  constructor(private readonly service: ProductsService) {}
  @Get() list() { return this.service.list(); }
  @Post() create(@Body() body: any, @Req() req: any) { return this.service.save(undefined,body,req.user); }
  @Post(':id') @HttpCode(200) update(@Param('id') id: string,@Body() body: any,@Req() req: any) { return this.service.save(id,body,req.user); }
}
@Module({controllers:[ProductsController],providers:[ProductsService]})
export class ProductsModule {}
